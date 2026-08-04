import { useColorScheme } from 'react-native';
import { Palette, Gradients } from '@/constants/colors';

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    isDark,
    colors: isDark ? Palette.dark : Palette.light,
    gradients: isDark ? Gradients.dark : Gradients.light,
  };
}
