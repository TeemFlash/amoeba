import { useRef, useState } from 'react';
import type { ElementRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Locale } from '../../src/domain/types';
import { validateAuthForm, type AuthFormIssue, type AuthFormMode } from '../../src/domain/authForm';

type Mode = AuthFormMode;
type MessageKey = AuthFormIssue | 'sign-in-unavailable' | 'sign-up-unavailable';
type InvalidField = 'email' | 'password' | 'confirmation' | null;
type Copy = {
  title: string;
  email: string;
  emailExample: string;
  password: string;
  confirmPassword: string;
  submitSignIn: string;
  submitSignUp: string;
  continueWithoutLogin: string;
  about: string;
  showPassword: string;
  hidePassword: string;
  reveal: string;
  hide: string;
  signUpMode: string;
  signInMode: string;
  mockNote: string;
  messages: Record<MessageKey, string>;
};

const copy: Record<Locale, Copy> = {
  ru: {
    title: 'Помощь рядом', email: 'Электронная почта', emailExample: 'name@example.com', password: 'Пароль', confirmPassword: 'Повторите пароль',
    submitSignIn: 'Войти', submitSignUp: 'Создать аккаунт', continueWithoutLogin: 'Продолжить без входа', about: 'О приложении',
    showPassword: 'Показать пароль', hidePassword: 'Скрыть пароль', reveal: 'Показать', hide: 'Скрыть', signUpMode: 'Создать аккаунт', signInMode: 'Уже есть аккаунт? Войти',
    mockNote: 'Макет: авторизация пока не подключена.',
    messages: {
      'email-required': 'Введите электронную почту.', 'email-invalid': 'Проверьте адрес электронной почты.', 'password-required': 'Введите пароль.',
      'password-short': 'Пароль должен содержать не менее 8 символов.', 'password-mismatch': 'Пароли не совпадают.',
      'sign-in-unavailable': 'Вход пока не подключён.', 'sign-up-unavailable': 'Регистрация пока не подключена.',
    },
  },
  kz: {
    title: 'Жақыннан көмек', email: 'Электрондық пошта', emailExample: 'name@example.com', password: 'Құпиясөз', confirmPassword: 'Құпиясөзді қайталаңыз',
    submitSignIn: 'Кіру', submitSignUp: 'Аккаунт жасау', continueWithoutLogin: 'Кірусіз жалғастыру', about: 'Қолданба туралы',
    showPassword: 'Құпиясөзді көрсету', hidePassword: 'Құпиясөзді жасыру', reveal: 'Көрсету', hide: 'Жасыру', signUpMode: 'Аккаунт жасау', signInMode: 'Аккаунтыңыз бар ма? Кіру',
    mockNote: 'Макет: авторизация әзірге қосылмаған.',
    messages: {
      'email-required': 'Электрондық поштаны енгізіңіз.', 'email-invalid': 'Электрондық пошта мекенжайын тексеріңіз.', 'password-required': 'Құпиясөзді енгізіңіз.',
      'password-short': 'Құпиясөз кемінде 8 таңбадан тұруы керек.', 'password-mismatch': 'Құпиясөздер сәйкес келмейді.',
      'sign-in-unavailable': 'Кіру әзірге қосылмаған.', 'sign-up-unavailable': 'Тіркелу әзірге қосылмаған.',
    },
  },
};

export type SignIn1Props = { locale: Locale; onContinue: () => void; onAbout: () => void };

export function SignIn1({ locale, onContinue, onAbout }: SignIn1Props) {
  const text = copy[locale];
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [messageKey, setMessageKey] = useState<MessageKey | null>(null);
  const passwordRef = useRef<ElementRef<typeof TextInput>>(null);
  const confirmationRef = useRef<ElementRef<typeof TextInput>>(null);
  const emailId = 'sign-in-email';
  const passwordId = 'sign-in-password';
  const confirmationId = 'sign-in-confirm-password';
  const labelledBy = (id: string) => Platform.OS === 'web'
    ? { 'aria-labelledby': id }
    : { accessibilityLabelledBy: id };
  const invalidField: InvalidField = messageKey === 'email-required' || messageKey === 'email-invalid'
    ? 'email'
    : messageKey === 'password-required' || messageKey === 'password-short'
      ? 'password'
      : messageKey === 'password-mismatch' ? 'confirmation' : null;
  const ariaInvalid = (field: Exclude<InvalidField, null>) => Platform.OS === 'web'
    ? { 'aria-invalid': invalidField === field }
    : {};
  const submit = () => {
    const issue = validateAuthForm(mode, email, password, confirmation);
    setMessageKey(issue ?? (mode === 'sign-in' ? 'sign-in-unavailable' : 'sign-up-unavailable'));
  };
  const changeMode = () => {
    setMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in');
    setConfirmation('');
    setMessageKey(null);
  };

  return <View style={styles.page}>
    <View style={styles.card}>
      <Text style={styles.brand}>{text.title}</Text>
      <Text accessibilityRole="header" style={styles.title}>{mode === 'sign-in' ? text.submitSignIn : text.submitSignUp}</Text>

      <View style={styles.field}>
        <Text nativeID={emailId} style={styles.label}>{text.email}</Text>
        <TextInput
          nativeID={`${emailId}-input`}
          {...labelledBy(emailId)} {...ariaInvalid('email')}
          accessibilityLabel={text.email}
          autoCapitalize="none" autoComplete="email" autoCorrect={false} keyboardType="email-address"
          onChangeText={(value) => { setEmail(value); setMessageKey(null); }}
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder={text.emailExample} placeholderTextColor="#A7A7A7" returnKeyType="next"
          style={[styles.input, invalidField === 'email' && styles.invalidInput]} textContentType="emailAddress" value={email}
        />
      </View>

      <View style={styles.field}>
        <Text nativeID={passwordId} style={styles.label}>{text.password}</Text>
        <View style={styles.passwordRow}>
          <TextInput
            ref={passwordRef}
            nativeID={`${passwordId}-input`}
            {...labelledBy(passwordId)} {...ariaInvalid('password')}
            accessibilityLabel={text.password}
            autoCapitalize="none" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            onChangeText={(value) => { setPassword(value); setMessageKey(null); }}
            onSubmitEditing={() => mode === 'sign-up' ? confirmationRef.current?.focus() : submit()}
            returnKeyType={mode === 'sign-up' ? 'next' : 'done'} secureTextEntry={!passwordVisible}
            style={[styles.input, styles.passwordInput, invalidField === 'password' && styles.invalidInput]}
            textContentType={mode === 'sign-in' ? 'password' : 'newPassword'} value={password}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? text.hidePassword : text.showPassword} onPress={() => setPasswordVisible((visible) => !visible)} style={styles.reveal}>
            <Text style={styles.revealText}>{passwordVisible ? text.hide : text.reveal}</Text>
          </Pressable>
        </View>
      </View>

      {mode === 'sign-up' ? <View style={styles.field}>
        <Text nativeID={confirmationId} style={styles.label}>{text.confirmPassword}</Text>
        <TextInput
          ref={confirmationRef}
          nativeID={`${confirmationId}-input`}
          {...labelledBy(confirmationId)} {...ariaInvalid('confirmation')}
          accessibilityLabel={text.confirmPassword}
          autoCapitalize="none" autoComplete="new-password"
          onChangeText={(value) => { setConfirmation(value); setMessageKey(null); }} onSubmitEditing={submit}
          returnKeyType="done" secureTextEntry={!passwordVisible}
          style={[styles.input, invalidField === 'confirmation' && styles.invalidInput]}
          textContentType="newPassword" value={confirmation}
        />
      </View> : null}

      {messageKey ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>{text.messages[messageKey]}</Text> : null}
      <Text accessibilityRole="text" style={styles.note}>{text.mockNote}</Text>
      <Pressable accessibilityRole="button" onPress={submit} style={styles.submit}>
        <Text style={styles.submitText}>{mode === 'sign-in' ? text.submitSignIn : text.submitSignUp}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={changeMode} style={styles.secondary}>
        <Text style={styles.secondaryText}>{mode === 'sign-in' ? text.signUpMode : text.signInMode}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onContinue} style={styles.secondary}><Text style={styles.secondaryText}>{text.continueWithoutLogin}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onAbout} style={styles.about}><Text style={styles.aboutText}>{text.about}</Text></Pressable>
    </View>
  </View>;
}

export default SignIn1;

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: 12, backgroundColor: '#121212' },
  card: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 16, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.08)', gap: 18 },
  brand: { color: '#D6E5FF', fontSize: 18, lineHeight: 26, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 32, lineHeight: 40, fontWeight: '700' },
  field: { gap: 8 },
  label: { color: '#FFFFFF', fontSize: 18, lineHeight: 26, fontWeight: '600' },
  input: { minHeight: 60, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 16, color: '#FFFFFF', fontSize: 18, lineHeight: 26 },
  invalidInput: { borderColor: '#FFB4AB' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passwordInput: { flex: 1, minWidth: 0 },
  reveal: { minWidth: 72, minHeight: 60, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  revealText: { color: '#D6E5FF', fontSize: 16, lineHeight: 22, fontWeight: '600' },
  message: { color: '#FFD8D8', fontSize: 17, lineHeight: 25 },
  note: { color: '#D0D0D0', fontSize: 16, lineHeight: 24 },
  submit: { minHeight: 60, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  submitText: { color: '#121212', fontSize: 18, lineHeight: 26, fontWeight: '700' },
  secondary: { minHeight: 60, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryText: { color: '#FFFFFF', fontSize: 18, lineHeight: 26, fontWeight: '600', textAlign: 'center' },
  about: { minHeight: 56, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  aboutText: { color: '#D6E5FF', fontSize: 17, lineHeight: 24, textDecorationLine: 'underline' },
});
