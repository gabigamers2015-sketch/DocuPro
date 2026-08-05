import { DarkTheme, DefaultTheme, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, Platform, View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import * as QuickActions from 'expo-quick-actions';
import { getAuth, onAuthStateChanged, User } from '@react-native-firebase/auth';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import LoginScreen from '@/components/login-screen';
import { AppThemeProvider } from '@/hooks/useTheme';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);

  useEffect(() => {
    const suscripcion = onAuthStateChanged(getAuth(), (u: User | null) => {
      setUsuario(u);
      setCargandoAuth(false);
    });
    return suscripcion;
  }, []);

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

  if (cargandoAuth) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppThemeProvider>
        <AnimatedSplashOverlay />
        {usuario ? <AppTabs /> : <LoginScreen />}
      </AppThemeProvider>
    </ThemeProvider>
  );
}
