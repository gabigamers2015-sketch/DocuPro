import { DarkTheme, DefaultTheme, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, Platform } from 'react-native';
import { useEffect } from 'react';
import * as QuickActions from 'expo-quick-actions';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AppThemeProvider } from '@/hooks/useTheme';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    QuickActions.setItems([
      {
        id: 'nueva-factura',
        title: 'Nueva Factura',
        subtitle: 'Crear un documento rápido',
        icon: Platform.OS === 'ios' ? 'symbol:doc.badge.plus' : 'shortcut_invoice',
      },
      {
        id: 'conversor',
        title: 'Conversor',
        subtitle: 'Unir o convertir PDFs',
        icon: Platform.OS === 'ios' ? 'symbol:arrow.triangle.2.circlepath' : 'shortcut_convert',
      },
    ]);

    const subscription = QuickActions.addListener((action) => {
      if (action.id === 'nueva-factura') {
        router.push('/');
      } else if (action.id === 'conversor') {
        router.push('/explore');
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppThemeProvider>
        <AnimatedSplashOverlay />
        <AppTabs />
      </AppThemeProvider>
    </ThemeProvider>
  );
}
