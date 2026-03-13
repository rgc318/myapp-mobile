/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#1677FF';
const tintColorDark = '#91CAFF';

export const Colors = {
  light: {
    text: '#1F2A37',
    background: '#F4F8FC',
    tint: tintColorLight,
    icon: '#7B8BA1',
    tabIconDefault: '#7B8BA1',
    tabIconSelected: tintColorLight,
    surface: '#FFFFFF',
    surfaceMuted: '#EEF4FB',
    border: '#D6E4F0',
    success: '#2F7D4A',
    warning: '#B7791F',
    danger: '#D14343',
    accentSoft: '#E8F1FF',
  },
  dark: {
    text: '#EAF2FF',
    background: '#111827',
    tint: tintColorDark,
    icon: '#A6B4C8',
    tabIconDefault: '#A6B4C8',
    tabIconSelected: tintColorDark,
    surface: '#182331',
    surfaceMuted: '#223247',
    border: '#334A63',
    success: '#68B27F',
    warning: '#E3AC53',
    danger: '#F08A8A',
    accentSoft: '#193153',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
