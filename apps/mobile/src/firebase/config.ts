export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
};

export type FirebaseConfigResult =
  | { mode: 'local' }
  | { mode: 'cloud'; config: FirebaseClientConfig }
  | { mode: 'emulator'; config: FirebaseClientConfig; emulatorHost: string }
  | { mode: 'invalid'; missing: string[] };

const fields = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'apiKey',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'authDomain',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'projectId',
  EXPO_PUBLIC_FIREBASE_APP_ID: 'appId',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'messagingSenderId',
} as const;

export function readFirebaseConfig(env: Record<string, string | undefined>): FirebaseConfigResult {
  const emulatorHost = env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST?.trim();
  if (emulatorHost) {
    const projectId = env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim();
    if (!projectId || !/^[A-Za-z0-9.-]+$/.test(emulatorHost)) return { mode: 'invalid', missing: ['EXPO_PUBLIC_FIREBASE_PROJECT_ID or valid EXPO_PUBLIC_FIREBASE_EMULATOR_HOST'] };
    return {
      mode: 'emulator',
      emulatorHost,
      config: {
        apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() || 'emulator-api-key',
        authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`,
        projectId,
        appId: env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim() || '1:000000000000:web:emulator',
        messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || '000000000000',
      },
    };
  }
  const missing = Object.keys(fields).filter((key) => !env[key]?.trim());
  if (missing.length === Object.keys(fields).length) return { mode: 'local' };
  if (missing.length) return { mode: 'invalid', missing };
  const config = Object.fromEntries(Object.entries(fields).map(([key, value]) => [value, env[key]!.trim()])) as FirebaseClientConfig;
  return { mode: 'cloud', config };
}

export const firebaseConfig = readFirebaseConfig({
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST,
});
