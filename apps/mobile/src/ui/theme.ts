export const theme = {
  colors: {
    background: '#E3F0FC', wave: '#D4E6FA', surface: '#FFFFFF', text: '#1F2A44', secondary: '#465873',
    primary: '#2457A7', border: '#A7B8CF', danger: '#A12B24', dangerSurface: '#FCEFEB',
    softBlue: '#DCEBFA', lavender: '#C9D3F8', cream: '#FFF6DC', accent: '#2196F3', muted: '#F3F6FA',
  },
  spacing: { xs: 8, sm: 12, md: 16, card: 20, lg: 24, xl: 32 },
  radius: { card: 22, button: 30, pill: 30 },
  type: { body: 19, caption: 18, title: 32, heading: 26, button: 20 },
  lineHeight: { body: 29, caption: 25, title: 40, heading: 34, button: 28 },
  minButtonHeight: 60,
  maxContentWidth: 760,
} as const;
