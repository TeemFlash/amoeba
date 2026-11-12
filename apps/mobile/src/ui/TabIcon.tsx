import { View } from 'react-native';

export type TabIconName = 'home' | 'activities' | 'requests' | 'profile';

export function TabIcon({ name, color, size = 26 }: { name: TabIconName; color: string; size?: number }) {
  const stroke = Math.max(2, Math.round(size * 0.075));
  const line = { position: 'absolute' as const, borderColor: color, borderWidth: stroke };
  if (name === 'home') return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <View style={[line, { left: size * 0.19, top: size * 0.12, width: size * 0.62, height: size * 0.62, borderRightWidth: 0, borderBottomWidth: 0, borderRadius: size * 0.08, transform: [{ rotate: '45deg' }] }]} />
    <View style={[line, { left: size * 0.22, top: size * 0.42, width: size * 0.56, height: size * 0.48, borderBottomWidth: 0, borderTopLeftRadius: size * 0.07, borderTopRightRadius: size * 0.07 }]} />
    <View style={[line, { left: size * 0.44, top: size * 0.59, width: size * 0.16, height: size * 0.31, borderTopLeftRadius: size * 0.05, borderTopRightRadius: size * 0.05 }]} />
  </View>;
  if (name === 'activities') return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <View style={[line, { left: size * 0.16, top: size * 0.28, width: size * 0.34, height: size * 0.34, borderRadius: size, backgroundColor: '#FFFFFF' }]} />
    <View style={[line, { right: size * 0.16, top: size * 0.28, width: size * 0.34, height: size * 0.34, borderRadius: size, backgroundColor: '#FFFFFF' }]} />
    <View style={[line, { left: size * 0.02, bottom: size * 0.01, width: size * 0.64, height: size * 0.42, borderBottomWidth: 0, borderTopLeftRadius: size * 0.36, borderTopRightRadius: size * 0.36 }]} />
    <View style={[line, { right: size * 0.02, bottom: size * 0.01, width: size * 0.64, height: size * 0.42, borderBottomWidth: 0, borderTopLeftRadius: size * 0.36, borderTopRightRadius: size * 0.36 }]} />
  </View>;
  if (name === 'requests') return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <View style={[line, { left: size * 0.19, top: size * 0.13, width: size * 0.62, height: size * 0.78, borderRadius: size * 0.12 }]} />
    <View style={[line, { left: size * 0.35, top: size * 0.06, width: size * 0.3, height: size * 0.18, borderRadius: size * 0.08, backgroundColor: '#FFFFFF' }]} />
    <View style={[line, { left: size * 0.34, top: size * 0.43, width: size * 0.36, height: stroke, borderWidth: 0, backgroundColor: color, borderRadius: size }]} />
    <View style={[line, { left: size * 0.34, top: size * 0.62, width: size * 0.36, height: stroke, borderWidth: 0, backgroundColor: color, borderRadius: size }]} />
  </View>;
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <View style={[line, { left: size * 0.34, top: size * 0.06, width: size * 0.32, height: size * 0.32, borderRadius: size }]} />
    <View style={[line, { left: size * 0.14, bottom: size * 0.04, width: size * 0.72, height: size * 0.42, borderBottomWidth: 0, borderTopLeftRadius: size * 0.4, borderTopRightRadius: size * 0.4 }]} />
  </View>;
}
