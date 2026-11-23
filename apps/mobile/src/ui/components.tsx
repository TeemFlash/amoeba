import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TranslationKey } from '../i18n';
import { theme } from './theme';
import { Icon, type IconName } from './icons';

export function Label({ children, muted = false, style }: PropsWithChildren<{ muted?: boolean; style?: object }>) {
  return <Text allowFontScaling style={[styles.body, muted && styles.muted, style]}>{children}</Text>;
}
export function Heading({ children, level = 'title', light = false, style }: PropsWithChildren<{ level?: 'title' | 'section'; light?: boolean; style?: object }>) {
  return <Text accessibilityRole="header" allowFontScaling style={[level === 'title' ? styles.title : styles.sectionHeading, light && styles.lightText, style]}>{children}</Text>;
}
export function Card({ children, tone = 'white', style }: PropsWithChildren<{ tone?: 'white' | 'blue' | 'yellow' | 'peach' | 'flat'; style?: object }>) {
  return <View style={[styles.card, styles[`tone_${tone}`], style]}>{children}</View>;
}
export function IconBadge({ name, color = theme.colors.primary, background = theme.colors.softBlue, size = 56, iconSize = 26 }: { name: IconName; color?: string; background?: string; size?: number; iconSize?: number }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.iconBadge, { backgroundColor: background, width: size, height: size, borderRadius: Math.min(size / 3, 20) }]}><Icon name={name} size={iconSize} color={color} /></View>;
}
export function ActionRow({ title, description, icon, onPress, accessibilityLabel, tone = 'blue', disabled = false, compact = false, style }: { title: string; description?: string; icon: IconName; onPress: () => void; accessibilityLabel: string; tone?: 'blue' | 'yellow' | 'peach'; disabled?: boolean; compact?: boolean; style?: object }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionRow, compact && styles.actionCompact, styles[`action_${tone}`], style, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    <Icon name={icon} color={theme.colors.secondary} size={22} />
    <View style={styles.actionCopy}><Text allowFontScaling style={styles.actionTitle}>{title}</Text>{description ? <Text allowFontScaling style={styles.actionDescription}>{description}</Text> : null}</View>
    <Icon name="arrow-right" color={theme.colors.primary} size={20} />
  </Pressable>;
}
export function Screen({ children, footer }: PropsWithChildren<{ footer?: ReactNode }>) {
  return <View style={styles.screen}><View style={styles.measure}>{children}</View>{footer ? <View style={styles.measure}>{footer}</View> : null}</View>;
}
export function SceneTransition({ children, routeKey }: PropsWithChildren<{ routeKey: string }>) {
  const { ready, reduced } = useMotionPreference();
  const [value] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    if (!ready) return undefined;
    if (reduced) {
      value.stopAnimation();
      value.setValue(1);
      return undefined;
    }
    value.setValue(0);
    animation = Animated.timing(value, { toValue: 1, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => { animation?.stop(); };
  }, [ready, reduced, routeKey, value]);
  const opacity = ready && !reduced ? value : 1;
  const translateY = ready && !reduced ? value.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) : 0;
  return <Animated.View style={{ width: '100%', opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}
function useMotionPreference() {
  const [motion, setMotion] = useState({ ready: false, nativeReduced: false, webReduced: false });
  useEffect(() => {
    let active = true;
    let nativeEventReceived = false;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && !nativeEventReceived) setMotion((current) => ({ ...current, ready: true, nativeReduced: value }));
    }).catch(() => {
      if (active && !nativeEventReceived) setMotion((current) => ({ ...current, ready: true, nativeReduced: true }));
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      nativeEventReceived = true;
      if (active) setMotion((current) => ({ ...current, ready: true, nativeReduced: value }));
    });
    let media: MediaQueryList | undefined;
    const updateWeb = (event: MediaQueryListEvent | MediaQueryList) => {
      if (active) setMotion((current) => ({ ...current, ready: true, webReduced: event.matches }));
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'matchMedia' in window) {
      media = window.matchMedia('(prefers-reduced-motion: reduce)');
      updateWeb(media);
      media.addEventListener?.('change', updateWeb);
    }
    return () => {
      active = false;
      subscription.remove();
      media?.removeEventListener?.('change', updateWeb);
    };
  }, []);
  return { ready: motion.ready, reduced: motion.nativeReduced || motion.webReduced };
}
export function Button({ label, onPress, kind = 'primary', disabled = false, accessibilityHint, accessibilityLabel, icon }: {
  label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean; accessibilityHint?: string; accessibilityLabel?: string; icon?: IconName;
}) {
  const iconColor = kind === 'primary' ? theme.colors.white : kind === 'danger' ? theme.colors.danger : theme.colors.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityHint={accessibilityHint} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[kind], disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    {icon ? <Icon name={icon} color={iconColor} /> : null}
    <Text allowFontScaling style={[styles.buttonText, kind === 'primary' && styles.primaryButtonText, kind === 'danger' && styles.dangerButtonText]}>{label}</Text>
  </Pressable>;
}
export function ChoiceGroup({ label, children }: PropsWithChildren<{ label: string }>) {
  const groupRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const group = groupRef.current;
    if (!group) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      const offsets: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      const offset = offsets[event.key];
      if (!offset) return;
      const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'))
        .filter((radio) => radio.getAttribute('aria-disabled') !== 'true' && !(radio as HTMLButtonElement).disabled);
      const active = document.activeElement;
      const current = radios.findIndex((radio) => radio === active || radio.contains(active));
      if (current < 0 || radios.length < 1) return;
      event.preventDefault();
      const next = radios[(current + offset + radios.length) % radios.length];
      next.focus();
      next.click();
    };
    group.addEventListener('keydown', handleKeyDown);
    return () => group.removeEventListener('keydown', handleKeyDown);
  }, []);
  return <View ref={(node) => { groupRef.current = node as unknown as HTMLElement | null; }} accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.choiceGroup}>{children}</View>;
}

export function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }} aria-checked={selected} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    <View style={[styles.radio, selected && styles.radioSelected]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{selected ? <Icon name="check" size={16} color={theme.colors.white} /> : null}</View>
    <Text allowFontScaling style={styles.choiceLabel}>{label}</Text>
  </Pressable>;
}
export function ErrorNotice({ children }: PropsWithChildren) {
  return <View accessibilityRole="alert" style={styles.error}><Icon name="info" size={22} color={theme.colors.danger} /><Text allowFontScaling style={styles.errorText}>{children}</Text></View>;
}
export function StatusTag({ label, cancelled = false }: { label: string; cancelled?: boolean }) {
  return <View accessibilityRole="status" accessibilityLiveRegion="polite" style={[styles.statusTag, cancelled && styles.statusCancelled]}><View style={[styles.statusDot, cancelled && styles.statusDotCancelled]} /><Text allowFontScaling style={[styles.statusText, cancelled && styles.statusCancelledText]}>{label}</Text></View>;
}
export function KeyValue({ label, value, icon }: { label: TranslationKey | string; value: string; icon?: IconName }) {
  return <View style={styles.keyValue}>{icon ? <IconBadge name={icon} size={42} iconSize={20} /> : null}<View style={styles.keyCopy}><Text allowFontScaling style={styles.key}>{label}</Text><Text allowFontScaling style={styles.body}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  screen: { width: '100%', alignItems: 'center' },
  measure: { width: '100%', maxWidth: theme.maxContentWidth, gap: theme.spacing.md },
  body: { color: theme.colors.text, fontSize: theme.type.body, lineHeight: 27 },
  muted: { color: theme.colors.secondary },
  title: { color: theme.colors.text, fontSize: theme.type.title, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5 },
  sectionHeading: { color: theme.colors.text, fontSize: theme.type.heading, lineHeight: 30, fontWeight: '700' },
  lightText: { color: theme.colors.white },
  eyebrow: { color: theme.colors.primaryDark, fontSize: 14, lineHeight: 20, fontWeight: '800', letterSpacing: 1 },
  lightMuted: { color: '#EAF0FF' },
  card: { borderRadius: theme.radius.card, padding: theme.spacing.lg, gap: theme.spacing.md },
  tone_white: { backgroundColor: theme.colors.surface }, tone_blue: { backgroundColor: theme.colors.paleBlue }, tone_yellow: { backgroundColor: theme.colors.softYellow }, tone_peach: { backgroundColor: theme.colors.softPeach }, tone_flat: { backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 8 },
  iconBadge: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionRow: { minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, paddingHorizontal: 4, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionCompact: { minHeight: 60, paddingVertical: 8 },
  action_blue: { backgroundColor: 'transparent' }, action_yellow: { backgroundColor: 'transparent' }, action_peach: { backgroundColor: 'transparent' },
  actionCopy: { flex: 1, gap: 3, minWidth: 0 }, actionTitle: { color: theme.colors.text, fontSize: 20, lineHeight: 27, fontWeight: '600' }, actionDescription: { color: theme.colors.secondary, fontSize: 17, lineHeight: 24 },
  button: { minHeight: theme.minButtonHeight, flexDirection: 'row', gap: 10, paddingVertical: 14, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: 'transparent', borderRadius: theme.radius.button, justifyContent: 'center', alignItems: 'center' },
  primary: { backgroundColor: theme.colors.primary }, secondary: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, quiet: { backgroundColor: 'transparent', borderColor: 'transparent' }, danger: { backgroundColor: theme.colors.dangerSurface },
  disabled: { opacity: 0.55 }, pressed: { opacity: 0.83 }, buttonText: { color: theme.colors.text, fontSize: theme.type.body, lineHeight: 26, textAlign: 'center', fontWeight: '700', flexShrink: 1 }, primaryButtonText: { color: theme.colors.white }, dangerButtonText: { color: theme.colors.danger },
  choiceGroup: { width: '100%', gap: 10 },
  choice: { minHeight: theme.minButtonHeight, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }, choiceSelected: { backgroundColor: theme.colors.softBlue, borderColor: theme.colors.primary },
  choiceLabel: { flex: 1, flexShrink: 1, color: theme.colors.text, fontSize: theme.type.body, lineHeight: 27, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  radio: { height: 26, width: 26, borderRadius: 13, borderWidth: 2, borderColor: theme.colors.secondary, backgroundColor: theme.colors.white, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }, radioSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  error: { backgroundColor: theme.colors.dangerSurface, padding: theme.spacing.md, borderRadius: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, errorText: { flex: 1, color: theme.colors.danger, fontSize: theme.type.body, lineHeight: 27, fontWeight: '600' },
  statusTag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: theme.radius.pill, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: theme.colors.softBlue }, statusText: { color: theme.colors.primaryDark, fontSize: 15, lineHeight: 21, fontWeight: '700', flexShrink: 1 }, statusCancelled: { backgroundColor: theme.colors.muted }, statusCancelledText: { color: theme.colors.secondary }, statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary }, statusDotCancelled: { backgroundColor: theme.colors.secondary },
  keyValue: { flexDirection: 'row', alignItems: 'center', gap: 12 }, keyCopy: { flex: 1, minWidth: 0, gap: 4 }, key: { color: theme.colors.secondary, fontSize: 15, lineHeight: 21, fontWeight: '700' },
});
