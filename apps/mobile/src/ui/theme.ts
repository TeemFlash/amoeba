export const theme = {
  colors: {
    background: '#F7F5EF', surface: '#FFFFFF', text: '#172820', secondary: '#52635A',
    primary: '#244F91', primaryDark: '#183A70', border: '#D8DED9',
    paleBlue: '#EFF3F8', softBlue: '#E2EAF4', warmYellow: '#F5E8C8', softYellow: '#FBF6E9',
    peach: '#F2E2D8', softPeach: '#FAF1EB', danger: '#9C3029', dangerSurface: '#FFF0ED',
    muted: '#E9ECE8', white: '#FFFFFF',
  },
  spacing: { xs: 8, sm: 12, md: 16, lg: 22, xl: 30, xxl: 40 },
  radius: { card: 16, row: 16, button: 14, pill: 24 },
  type: { body: 18, caption: 16, title: 30, heading: 22, display: 32 },
  minButtonHeight: 56,
  maxContentWidth: 960,
} as const;
