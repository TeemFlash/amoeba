import { Image, type ImageStyle, type StyleProp } from 'react-native';

export type IllustrationScene = 'armchair' | 'phone' | 'apple' | 'tea' | 'park' | 'game';

type Props = {
  scene: IllustrationScene;
  height?: number;
  style?: StyleProp<ImageStyle>;
};

const illustrations: Record<IllustrationScene, number> = {
  armchair: require('../../assets/illustrations/armchair.png'),
  phone: require('../../assets/illustrations/phone.png'),
  apple: require('../../assets/illustrations/apple.png'),
  tea: require('../../assets/illustrations/tea.png'),
  park: require('../../assets/illustrations/park.png'),
  game: require('../../assets/illustrations/game.png'),
};

export function MobiIllustration({ scene, height = 140, style }: Props) {
  return (
    <Image
      source={illustrations[scene]}
      resizeMode="contain"
      accessible={false}
      importantForAccessibility="no"
      style={[{ width: '100%', height }, style]}
    />
  );
}
