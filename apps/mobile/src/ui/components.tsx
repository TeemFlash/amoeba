import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { Locale } from '../domain/types';
import { t, type TranslationKey } from '../i18n';
import { theme } from './theme';
import { useTextScale } from './Typography';

export function Label({ children, muted = false, style }: PropsWithChildren<{ muted?: boolean; style?: TextStyle }>) {
  const scale = useTextScale();
  const { fontSize, lineHeight, ...rest } = style ?? {};
  return <Text style={[styles.body, { fontSize: (fontSize ?? theme.type.body) * scale, lineHeight: (lineHeight ?? theme.lineHeight.body) * scale }, muted && styles.muted, rest]}>{children}</Text>;
}
export function Heading({ children, level = 'title' }: PropsWithChildren<{ level?: 'title' | 'section' }>) {
  const scale = useTextScale();
  const headingStyle = level === 'title' ? styles.title : styles.sectionHeading;
  const size = level === 'title' ? theme.type.title : theme.type.heading;
  const lineHeight = level === 'title' ? theme.lineHeight.title : theme.lineHeight.heading;
  return <Text accessibilityRole="header" style={[headingStyle, { fontSize: size * scale, lineHeight: lineHeight * scale }]}>{children}</Text>;
}
export function Card({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Notice({ locale }: { locale: Locale }) {
  const scale = useTextScale();
  return <View accessibilityRole="text" style={styles.notice}><Text style={[styles.noticeText, { fontSize: theme.type.caption * scale, lineHeight: theme.lineHeight.caption * scale }]}>{t(locale, 'demoNotice')}</Text></View>;
}
export function Screen({ children, footer }: PropsWithChildren<{ footer?: ReactNode }>) {
  return <View style={styles.screen}>
    <View style={styles.measure}>{children}</View>
    {footer ? <View style={styles.measure}>{footer}</View> : null}
  </View>;
}
export function StepIndicator({ label, current, total }: { label: string; current: number; total: number }) {
  const scale = useTextScale();
  return <View accessibilityRole="text" accessibilityLabel={label} style={styles.stepIndicator}>
    <Text importantForAccessibility="no" style={[styles.stepLabel, { fontSize: theme.type.caption * scale, lineHeight: theme.lineHeight.caption * scale }]}>{label}</Text>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stepTrack}>
      {Array.from({ length: total }, (_, index) => <View key={index} style={[styles.stepSegment, index < current && styles.stepSegmentActive]} />)}
    </View>
  </View>;
}
export function Button({ label, onPress, kind = 'primary', disabled = false, accessibilityHint, accessibilityLabel }: {
  label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean; accessibilityHint?: string; accessibilityLabel?: string;
}) {
  const scale = useTextScale();
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.button, styles[kind], disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}
  >
    <Text style={[styles.buttonText, { fontSize: theme.type.button * scale, lineHeight: theme.lineHeight.button * scale }, kind === 'primary' && styles.primaryButtonText, kind === 'danger' && styles.dangerButtonText, disabled && styles.buttonDisabledText]}>{label}</Text>
  </Pressable>;
}
export function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const scale = useTextScale();
  return <Pressable
    accessibilityRole="radio"
    accessibilityLabel={label}
    accessibilityState={{ checked: selected, disabled }}
    aria-checked={selected}
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}
  >
    <View style={[styles.radio, selected && styles.radioSelected]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
    <Text style={[styles.choiceLabel, { fontSize: theme.type.body * scale, lineHeight: theme.lineHeight.body * scale }]}>{label}</Text>
  </Pressable>;
}
export function ErrorNotice({ children }: PropsWithChildren) {
  const scale = useTextScale();
  return <View accessibilityRole="alert" style={styles.error}><Text style={[styles.errorText, { fontSize: theme.type.body * scale, lineHeight: theme.lineHeight.body * scale }]}>{children}</Text></View>;
}
export function StatusTag({ label, cancelled = false, variant }: { label: string; cancelled?: boolean; variant?: 'available' | 'full' | 'cancelled' }) {
  const scale = useTextScale();
  const resolved = variant ?? (cancelled ? 'cancelled' : undefined);
  const visual = resolved === 'available' ? styles.statusAvailable : resolved === 'full' ? styles.statusFull : resolved === 'cancelled' ? styles.statusCancelled : undefined;
  const visualText = resolved === 'available' ? styles.statusAvailableText : resolved === 'full' ? styles.statusFullText : resolved === 'cancelled' ? styles.statusCancelledText : undefined;
  const prefix = resolved === 'available' ? '✓ ' : resolved === 'full' ? '! ' : resolved === 'cancelled' ? '× ' : '';
  return <View accessibilityRole="status" accessibilityLiveRegion="polite" style={[styles.statusTag, visual]}><Text style={[styles.statusText, { fontSize: theme.type.caption * scale, lineHeight: theme.lineHeight.caption * scale }, visualText]}>{prefix}{label}</Text></View>;
}
export function KeyValue({ label, value }: { label: TranslationKey | string; value: string }) {
  const scale = useTextScale();
  return <View style={styles.keyValue}><Text style={[styles.key, { fontSize: theme.type.caption * scale, lineHeight: theme.lineHeight.caption * scale }]}>{label}</Text><Text style={[styles.body, { fontSize: theme.type.body * scale, lineHeight: theme.lineHeight.body * scale }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { width: '100%', alignItems: 'center', gap: theme.spacing.lg },
  measure: { width: '100%', maxWidth: theme.maxContentWidth, gap: theme.spacing.md },
  body: { color: theme.colors.text, fontSize: theme.type.body, lineHeight: theme.lineHeight.body, flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  muted: { color: theme.colors.secondary },
  title: { color: theme.colors.text, fontSize: theme.type.title, lineHeight: theme.lineHeight.title, fontWeight: '700', flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  sectionHeading: { color: theme.colors.text, fontSize: theme.type.heading, lineHeight: theme.lineHeight.heading, fontWeight: '700', flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.card, padding: theme.spacing.card, gap: theme.spacing.md },
  notice: { borderRadius: theme.radius.pill, borderColor: theme.colors.border, borderWidth: 1, backgroundColor: theme.colors.softBlue, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  noticeText: { color: theme.colors.text, fontSize: theme.type.caption, lineHeight: theme.lineHeight.caption, fontWeight: '700', textAlign: 'center', flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  stepIndicator: { gap: 10, paddingHorizontal: 2, paddingVertical: 2 },
  stepLabel: { color: theme.colors.secondary, fontSize: theme.type.caption, lineHeight: theme.lineHeight.caption, fontWeight: '700', flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  stepTrack: { flexDirection: 'row', gap: 8 },
  stepSegment: { flex: 1, height: 8, borderRadius: 8, backgroundColor: theme.colors.softBlue },
  stepSegmentActive: { backgroundColor: theme.colors.primary },
  button: { minHeight: theme.minButtonHeight, paddingVertical: 14, paddingHorizontal: theme.spacing.lg, borderWidth: 2, borderRadius: theme.radius.pill, justifyContent: 'center', alignItems: 'center' },
  primary: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary },
  quiet: { backgroundColor: 'transparent', borderColor: theme.colors.border },
  danger: { backgroundColor: theme.colors.dangerSurface, borderColor: theme.colors.danger },
  buttonDisabled: { backgroundColor: '#E7EDF5', borderColor: '#70839B' }, buttonPressed: { opacity: 0.78 },
  buttonText: { color: theme.colors.text, fontSize: theme.type.button, lineHeight: theme.lineHeight.button, textAlign: 'center', fontWeight: '700', flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  primaryButtonText: { color: theme.colors.surface }, dangerButtonText: { color: theme.colors.danger }, buttonDisabledText: { color: theme.colors.text },
  choice: { minHeight: theme.minButtonHeight, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  choiceSelected: { borderColor: theme.colors.primary, borderWidth: 2, backgroundColor: theme.colors.softBlue },
  choiceLabel: { flex: 1, flexShrink: 1, color: theme.colors.text, fontSize: theme.type.body, lineHeight: theme.lineHeight.body, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  radio: { height: 30, width: 30, borderRadius: 15, borderWidth: 2, borderColor: theme.colors.secondary, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  radioSelected: { borderColor: theme.colors.primary }, radioDot: { height: 16, width: 16, borderRadius: 8, backgroundColor: theme.colors.primary },
  error: { borderLeftWidth: 5, borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerSurface, padding: theme.spacing.md, borderRadius: 16 },
  errorText: { color: theme.colors.danger, fontSize: theme.type.body, lineHeight: theme.lineHeight.body, fontWeight: '700', flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  statusTag: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.md, paddingVertical: 8, backgroundColor: theme.colors.softBlue, borderWidth: 1, borderColor: theme.colors.primary },
  statusText: { color: theme.colors.text, fontSize: theme.type.caption, lineHeight: theme.lineHeight.caption, fontWeight: '700', flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  statusAvailable: { backgroundColor: '#E1F2E6', borderColor: '#39734E' }, statusAvailableText: { color: '#245735' },
  statusFull: { backgroundColor: theme.colors.cream, borderColor: '#85631A' }, statusFullText: { color: '#654900' },
  statusCancelled: { backgroundColor: theme.colors.muted, borderColor: theme.colors.secondary }, statusCancelledText: { color: theme.colors.secondary },
  keyValue: { gap: theme.spacing.xs }, key: { color: theme.colors.secondary, fontSize: theme.type.caption, lineHeight: theme.lineHeight.caption, fontWeight: '700', flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
});
