export const theme = {
  colors: {
    background: '#F7F6F0', surface: '#FFFFFF', text: '#172B24', secondary: '#45574E',
    primary: '#245A43', border: '#C8D3CC', danger: '#A12B24', dangerSurface: '#FCEFEB',
    softGreen: '#EAF1EB', muted: '#F1F2EC',
  },
  spacing: { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 },
  radius: { card: 20, button: 14, pill: 24 },
  type: { body: 18, caption: 16, title: 28, heading: 22 },
  minButtonHeight: 56,
  maxContentWidth: 760,
} as const;
