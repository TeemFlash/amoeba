import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Platform } from 'react-native';

export type IconName = 'home' | 'basket' | 'calendar' | 'list' | 'info' | 'arrow-right' | 'back' | 'clock' | 'pin' | 'heart' | 'spark' | 'phone' | 'people' | 'check';
type Props = { name: IconName; size?: number; color?: string };

export function Icon({ name, size = 24, color = '#2852D8' }: Props) {
  const common = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  let drawing;
  switch (name) {
    case 'home': drawing = <><Path {...common} d="m3.5 10 8.5-7 8.5 7v10a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 20V10Z"/><Path {...common} d="M9 21.5v-7h6v7"/></>; break;
    case 'basket': drawing = <><Path {...common} d="m3.5 10 2 10h13l2-10h-17Z"/><Path {...common} d="m8 10 4-6 4 6M8 14v3M12 14v3M16 14v3"/></>; break;
    case 'calendar': drawing = <><Rect {...common} x="3.5" y="5" width="17" height="16" rx="2.5"/><Path {...common} d="M7.5 3v4M16.5 3v4M4 9.5h16M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/></>; break;
    case 'list': drawing = <><Path {...common} d="M9 6h11M9 12h11M9 18h11"/><Circle {...common} cx="4.5" cy="6" r=".8"/><Circle {...common} cx="4.5" cy="12" r=".8"/><Circle {...common} cx="4.5" cy="18" r=".8"/></>; break;
    case 'info': drawing = <><Circle {...common} cx="12" cy="12" r="9"/><Path {...common} d="M12 11v5M12 7.5h.01"/></>; break;
    case 'arrow-right': drawing = <Path {...common} d="M4 12h15m-6-6 6 6-6 6"/>; break;
    case 'back': drawing = <Path {...common} d="m14.5 5-7 7 7 7M8 12h12"/>; break;
    case 'clock': drawing = <><Circle {...common} cx="12" cy="12" r="9"/><Path {...common} d="M12 7v5l3.5 2"/></>; break;
    case 'pin': drawing = <><Path {...common} d="M19 10c0 5.5-7 11-7 11S5 15.5 5 10a7 7 0 1 1 14 0Z"/><Circle {...common} cx="12" cy="10" r="2"/></>; break;
    case 'heart': drawing = <Path {...common} d="M20.8 8.7c0 4.2-8.8 10.4-8.8 10.4S3.2 12.9 3.2 8.7a4.5 4.5 0 0 1 8.8-1.2 4.5 4.5 0 0 1 8.8 1.2Z"/>; break;
    case 'spark': drawing = <><Path {...common} d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z"/><Path {...common} d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>; break;
    case 'phone': drawing = <><Rect {...common} x="6.5" y="2.5" width="11" height="19" rx="2.5"/><Path {...common} d="M10 5.5h4M11.5 18h1"/></>; break;
    case 'people': drawing = <><Circle {...common} cx="9" cy="8" r="3.2"/><Path {...common} d="M2.5 20v-1.1A5.4 5.4 0 0 1 8 13.5h2a5.4 5.4 0 0 1 5.5 5.4V20M16 5a3.1 3.1 0 0 1 0 6M17 14a4.6 4.6 0 0 1 4.5 4.5v.6"/></>; break;
    case 'check': drawing = <Path {...common} d="m5 12 4.2 4.2L19 6.5"/>; break;
  }
  const hiddenFromAssistiveTechnology = Platform.OS === 'web'
    ? { 'aria-hidden': true as const }
    : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };
  return <Svg width={size} height={size} viewBox="0 0 24 24" {...hiddenFromAssistiveTechnology}>{drawing}</Svg>;
}
