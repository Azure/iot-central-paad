// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export const HISTORY_LIMIT = 120;
export const SERIES_LIMIT = 12;

export type Sample = Readonly<{timestamp: number; value: number | null}>;
export type Series = Readonly<{id: string; samples: readonly Sample[]}>;
export type History = Readonly<{
  series: readonly Series[];
  unavailable: boolean;
}>;

export const emptyHistory = (): History => ({series: [], unavailable: true});

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function numericFields(
  telemetryId: string,
  value: unknown,
): ReadonlyArray<readonly [string, number | null]> {
  if (typeof value === 'number') {
    return [[telemetryId, finite(value) ? value : null]];
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, SERIES_LIMIT)
    .map(([key, field]) => [key, finite(field) ? field : null] as const);
}

export function appendSample(
  previous: History,
  telemetryId: string,
  value: unknown,
  timestamp: number,
): History {
  if (!finite(timestamp)) {
    return previous;
  }
  const fields = new Map(numericFields(telemetryId, value));
  const ids = Array.from(
    new Set([...previous.series.map(series => series.id), ...fields.keys()]),
  ).slice(0, SERIES_LIMIT);
  return {
    unavailable: !ids.some(id => finite(fields.get(id))),
    series: ids.map(id => {
      const existing = previous.series.find(series => series.id === id);
      return {
        id,
        samples: [
          ...(existing?.samples ?? []).slice(-(HISTORY_LIMIT - 1)),
          {timestamp, value: fields.get(id) ?? null},
        ],
      };
    }),
  };
}

export function summarize(samples: readonly Sample[]) {
  const values = samples
    .map(sample => sample.value)
    .filter((value): value is number => value !== null && finite(value));
  if (!values.length) {
    return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const magnitude = Math.max(Math.abs(min), Math.abs(max));
  // Scaling first keeps finite sensor readings from overflowing the mean.
  const normalizedMean = magnitude
    ? values.reduce((sum, value) => sum + value / magnitude, 0) / values.length
    : 0;
  return {
    latest: samples[samples.length - 1]?.value ?? null,
    min,
    max,
    average: Math.max(-1, Math.min(1, normalizedMean)) * magnitude,
    count: values.length,
  };
}

export function formatValue(value: number | null): string {
  if (value === null || !finite(value)) {
    return 'Unavailable';
  }
  if (value === 0) {
    return '0';
  }
  if (Math.abs(value) >= 1000000 || Math.abs(value) < 0.001) {
    return value.toExponential(3);
  }
  return Number(value.toPrecision(6)).toString();
}

const palettes = {
  light: ['#1261A0', '#A13C13', '#167044', '#813CAD', '#A32962', '#52620C'],
  dark: ['#79BEFF', '#FFB287', '#75DBAD', '#C7A0FF', '#FF9CC7', '#CEDD7A'],
};

export function seriesColor(id: string, dark: boolean): string {
  const hash = Array.from(id).reduce(
    (current, character) => (current * 31 + character.charCodeAt(0)) % 65521,
    0,
  );
  const palette = dark ? palettes.dark : palettes.light;
  return palette[hash % palette.length];
}

export function readLocation(
  value: unknown,
): {lat: number; lon: number; latD?: number; lonD?: number} | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const {lat, lon, latD, lonD} = value as {
    lat?: unknown;
    lon?: unknown;
    latD?: unknown;
    lonD?: unknown;
  };
  if (
    !finite(lat) ||
    !finite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return null;
  }
  return {
    lat,
    lon,
    ...(finite(latD) && latD > 0 && latD <= 180 ? {latD} : {}),
    ...(finite(lonD) && lonD > 0 && lonD <= 360 ? {lonD} : {}),
  };
}
