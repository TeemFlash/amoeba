import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== '@react-native-google-signin/google-signin';
  });
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
  if (iosUrlScheme?.startsWith('com.googleusercontent.apps.')) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }
  return {
    ...config,
    name: config.name ?? 'Mobi',
    slug: config.slug ?? 'mobi',
    plugins,
    ios: { ...config.ios, bundleIdentifier: config.ios?.bundleIdentifier ?? 'dev.enactus.seniorhelp.demo' },
  };
};
