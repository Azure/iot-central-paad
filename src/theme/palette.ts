const light = {
  // Solid headers meet the top of the page gradient without a colour seam.
  background: '#ECF7ED',
  gradientStart: '#ECF7ED',
  gradientEnd: '#C2E3CA',
  surface: '#FCFEFC',
  surfaceRaised: '#FFFFFF',
  surfaceShade: '#F1F7F2',
  surfaceBorder: '#D7E4D9',
  inset: '#E7F1E8',
  text: '#20302A',
  muted: '#4C5C52',
  border: '#C5D4C7',
  controlBorder: '#5F7365',
  primary: '#285A48',
  primaryDeep: '#22503F',
  channel: '#2B6551',
  channelGlow: '#7FC9AB',
  onPrimary: '#FFFFFF',
  positive: '#17634F',
  positiveSurface: '#E3F3EB',
  danger: '#A73C39',
  dangerSurface: '#FBECE9',
  tints: ['#E5EDE3', '#ECE6F2', '#F4E7DB', '#E7EDEB'],
  toolSurfaces: ['#DCEFE7', '#E5E1F6', '#FAE3D3', '#DBE8F7'],
  toolAccents: ['#1F6B57', '#4A5A86', '#8A5A32', '#2A6E86'],
  toolOnAccent: '#FFFFFF',
};

const dark = {
  background: '#0F1C18',
  gradientStart: '#14221D',
  gradientEnd: '#0B1613',
  surface: '#1D2F28',
  surfaceRaised: '#25392F',
  surfaceShade: '#192A23',
  surfaceBorder: '#33473D',
  inset: '#17251F',
  text: '#ECF3EE',
  muted: '#B5C5B9',
  border: '#3B5145',
  controlBorder: '#8A9F8E',
  primary: '#91CEB2',
  primaryDeep: '#80BFA2',
  channel: '#78B79A',
  channelGlow: '#E6FFF4',
  onPrimary: '#142C2A',
  positive: '#97DFC0',
  positiveSurface: '#233D35',
  danger: '#FFB4AC',
  dangerSurface: '#432F30',
  tints: ['#253C35', '#343347', '#433831', '#3D3C2F'],
  toolSurfaces: ['#1D3A33', '#2B2947', '#3C2A1E', '#1C3047'],
  toolAccents: ['#6FC7AC', '#9AA8DC', '#D79E70', '#7FBCD0'],
  toolOnAccent: '#142C2A',
};

export const palette = (isDark: boolean) => (isDark ? dark : light);

export function cardTint(key: string, isDark: boolean): string {
  const colors = palette(isDark).tints;
  let index = 0;
  for (const character of key) {
    index = (index + character.charCodeAt(0)) % colors.length;
  }
  return colors[index];
}
