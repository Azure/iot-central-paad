import {
  appendSample,
  emptyHistory,
  formatValue,
  HISTORY_LIMIT,
  numericFields,
  readLocation,
  SERIES_LIMIT,
  seriesColor,
  summarize,
} from '../src/charts/history';

describe('local chart history', () => {
  it('keeps an immutable, bounded scalar history with genuine zero values', () => {
    const initial = appendSample(emptyHistory(), 'battery', 0, 0);
    let history = initial;
    for (let index = 1; index <= 150; index++) {
      history = appendSample(history, 'battery', index, index);
    }
    expect(initial.series[0].samples).toEqual([{timestamp: 0, value: 0}]);
    expect(history.series[0].samples).toHaveLength(HISTORY_LIMIT);
    expect(history.series[0].samples[0].value).toBe(31);
    expect(summarize(history.series[0].samples)).toEqual({
      latest: 150,
      min: 31,
      max: 150,
      average: expect.closeTo(90.5, 10),
      count: 120,
    });
  });

  it('tracks vector components independently and marks absent axes as gaps', () => {
    const first = appendSample(
      emptyHistory(),
      'motion',
      {z: 3, x: -1, y: 2},
      1,
    );
    const next = appendSample(first, 'motion', {x: 0, z: NaN}, 2);
    expect(next.series.map(series => series.id)).toEqual(['x', 'y', 'z']);
    expect(next.series.map(series => series.samples[1].value)).toEqual([
      0,
      null,
      null,
    ]);
    expect(first.series[1].samples).toHaveLength(1);
    expect(summarize(next.series[1].samples).latest).toBeNull();
    expect(next.unavailable).toBe(false);
  });

  it.each([undefined, null, '12', true, [], NaN, Infinity, -Infinity, {}])(
    'does not invent a value for %p',
    value => {
      const history = appendSample(emptyHistory(), 'test', value, 1);
      expect(history.unavailable).toBe(true);
      expect(
        history.series
          .flatMap(series => series.samples)
          .every(sample => sample.value === null),
      ).toBe(true);
    },
  );

  it('rejects nested and nonnumeric vector values without coercion', () => {
    expect(numericFields('motion', {x: '1', y: {value: 2}, z: 0})).toEqual([
      ['x', null],
      ['y', null],
      ['z', 0],
    ]);
  });

  it('retains earlier statistics but does not mislabel them as a latest reading', () => {
    const first = appendSample(emptyHistory(), 'test', 4, 1);
    const next = appendSample(first, 'test', undefined, 2);
    expect(next.unavailable).toBe(true);
    expect(summarize(next.series[0].samples)).toEqual({
      latest: null,
      min: 4,
      max: 4,
      average: 4,
      count: 1,
    });
  });

  it('bounds composite series count and rejects invalid timestamps', () => {
    let history = emptyHistory();
    for (let index = 0; index < 30; index++) {
      history = appendSample(
        history,
        'test',
        {[`field${index}`]: index},
        index,
      );
    }
    expect(history.series).toHaveLength(SERIES_LIMIT);
    expect(appendSample(history, 'test', 1, NaN)).toBe(history);
  });

  it('computes finite summaries for extreme readings and formats small values', () => {
    expect(
      summarize([
        {timestamp: 1, value: Number.MAX_VALUE},
        {timestamp: 2, value: Number.MAX_VALUE},
      ]).average,
    ).toBe(Number.MAX_VALUE);
    expect(formatValue(0.0000001)).toBe('1.000e-7');
    expect(formatValue(null)).toBe('Unavailable');
    expect(summarize([{timestamp: 1, value: null}])).toBeNull();
  });

  it('uses stable theme-adaptive colors', () => {
    expect(seriesColor('x', false)).toBe(seriesColor('x', false));
    expect(seriesColor('x', false)).not.toBe(seriesColor('x', true));
    expect(
      new Set(['x', 'y', 'z'].map(id => seriesColor(id, false))).size,
    ).toBe(3);
  });

  it('validates locations including legitimate zero coordinates', () => {
    expect(readLocation({lat: 0, lon: 0})).toEqual({lat: 0, lon: 0});
    expect(readLocation({lat: 0, lon: 0, latD: 0.1, lonD: 0.2})).toEqual({
      lat: 0,
      lon: 0,
      latD: 0.1,
      lonD: 0.2,
    });
    expect(readLocation({lat: 0, lon: 0, latD: NaN, lonD: -1})).toEqual({
      lat: 0,
      lon: 0,
    });
    for (const value of [
      null,
      {},
      {lat: NaN, lon: 1},
      {lat: 91, lon: 0},
      {lat: 0, lon: 181},
      {lat: '2', lon: 3},
    ]) {
      expect(readLocation(value)).toBeNull();
    }
  });
});
