import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../domain/types';
import { t, type TranslationKey } from '../i18n';
import { theme } from './theme';

export function Label({ children, muted = false, style }: PropsWithChildren<{ muted?: boolean; style?: object }>) {
  return <Text maxFontSizeMultiplier={undefined} style={[styles.body, muted && styles.muted, style]}>{children}</Text>;
}
export function Heading({ children, level = 'title' }: PropsWithChildren<{ level?: 'title' | 'section' }>) {
  return <Text accessibilityRole="header" style={level === 'title' ? styles.title : styles.sectionHeading}>{children}</Text>;
}
export function Card({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Notice({ locale }: { locale: Locale }) {
  return <View accessibilityRole="text" style={styles.notice}><Text style={styles.noticeText}>{t(locale, 'demoNotice')}</Text></View>;
}
export function Screen({ children, footer }: PropsWithChildren<{ footer?: ReactNode }>) {
  return <View style={styles.screen}>
    <View style={styles.measure}>{children}</View>
    {footer ? <View style={styles.measure}>{footer}</View> : null}
  </View>;
}
export function Button({ label, onPress, kind = 'primary', disabled = false, accessibilityHint, accessibilityLabel }: {
  label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean; accessibilityHint?: string; accessibilityLabel?: string;
}) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.button, styles[kind], disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}
  >
    <Text style={[styles.buttonText, kind === 'primary' && styles.primaryButtonText, kind === 'danger' && styles.dangerButtonText]}>{label}</Text>
  </Pressable>;
}
export function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
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
    <Text style={styles.choiceLabel}>{label}</Text>
  </Pressable>;
}
export function ErrorNotice({ children }: PropsWithChildren) {
  return <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{children}</Text></View>;
}
export function StatusTag({ label, cancelled = false }: { label: string; cancelled?: boolean }) {
  return <View accessibilityRole="status" accessibilityLiveRegion="polite" style={[styles.statusTag, cancelled && styles.statusCancelled]}><Text style={[styles.statusText, cancelled && styles.statusCancelledText]}>{label}</Text></View>;
}
export function KeyValue({ label, value }: { label: TranslationKey | string; value: string }) {
  return <View style={styles.keyValue}><Text style={styles.key}>{label}</Text><Text style={styles.body}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { width: '100%', alignItems: 'center', gap: theme.spacing.md },
  measure: { width: '100%', maxWidth: theme.maxContentWidth, gap: theme.spacing.md },
  body: { color: theme.colors.text, fontSize: theme.type.body, lineHeight: 27 },
  muted: { color: theme.colors.secondary },
  title: { color: theme.colors.text, fontSize: theme.type.title, lineHeight: 35, fontWeight: '700' },
  sectionHeading: { color: theme.colors.text, fontSize: theme.type.heading, lineHeight: 30, fontWeight: '700' },
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.card, padding: theme.spacing.lg, gap: theme.spacing.md },
  notice: { borderRadius: 14, borderColor: theme.colors.primary, borderWidth: 1, backgroundColor: theme.colors.softGreen, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  noticeText: { color: theme.colors.text, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  button: { minHeight: theme.minButtonHeight, paddingVertical: 14, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderRadius: theme.radius.button, justifyContent: 'center', alignItems: 'center' },
  primary: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary },
  quiet: { backgroundColor: 'transparent', borderColor: theme.colors.border },
  danger: { backgroundColor: theme.colors.dangerSurface, borderColor: theme.colors.danger },
  buttonDisabled: { opacity: 0.55 }, buttonPressed: { opacity: 0.78 },
  buttonText: { color: theme.colors.text, fontSize: theme.type.body, lineHeight: 25, textAlign: 'center', fontWeight: '600' },
  primaryButtonText: { color: theme.colors.surface }, dangerButtonText: { color: theme.colors.danger },
  choice: { minHeight: theme.minButtonHeight, borderRadius: theme.radius.button, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  choiceSelected: { borderColor: theme.colors.primary, borderWidth: 2, backgroundColor: theme.colors.softGreen },
  choiceLabel: { flex: 1, flexShrink: 1, color: theme.colors.text, fontSize: theme.type.body, lineHeight: 27, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  radio: { height: 24, width: 24, borderRadius: 12, borderWidth: 2, borderColor: theme.colors.secondary, justifyContent: 'center', alignItems: 'center' },
  radioSelected: { borderColor: theme.colors.primary }, radioDot: { height: 12, width: 12, borderRadius: 6, backgroundColor: theme.colors.primary },
  error: { borderLeftWidth: 4, borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerSurface, padding: theme.spacing.md, borderRadius: 10 },
  errorText: { color: theme.colors.danger, fontSize: theme.type.body, lineHeight: 27, fontWeight: '600' },
  statusTag: { alignSelf: 'flex-start', borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.md, paddingVertical: 8, backgroundColor: theme.colors.softGreen, borderWidth: 1, borderColor: theme.colors.primary },
  statusText: { color: theme.colors.primary, fontSize: theme.type.caption, lineHeight: 22, fontWeight: '700' },
  statusCancelled: { backgroundColor: theme.colors.muted, borderColor: theme.colors.secondary }, statusCancelledText: { color: theme.colors.secondary },
  keyValue: { gap: theme.spacing.xs }, key: { color: theme.colors.secondary, fontSize: theme.type.caption, lineHeight: 23, fontWeight: '600' },
});
