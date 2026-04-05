import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { FeedbackProvider } from '@/providers/feedback-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigation() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!isAuthenticated && pathname !== '/login') {
      router.replace('/login');
      return;
    }

    if (isAuthenticated && (pathname === '/' || pathname === '/login')) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isReady, pathname, router]);

  if (!isReady) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View
          style={{
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
          }}>
          <ActivityIndicator size="large" />
        </View>
        <StatusBar style="auto" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="account-info" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="system-info" options={{ headerShown: false }} />
        <Stack.Screen name="sales/order/create" options={{ headerShown: false }} />
        <Stack.Screen name="sales/order/[orderName]" options={{ headerShown: false }} />
        <Stack.Screen name="sales/invoice/preview" options={{ headerShown: false }} />
        <Stack.Screen name="sales/invoice/pdf-viewer" options={{ headerShown: false }} />
        <Stack.Screen name="purchase/invoice/preview" options={{ headerShown: false }} />
        <Stack.Screen name="purchase/invoice/pdf-viewer" options={{ headerShown: false }} />
        <Stack.Screen name="purchase/order/create" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FeedbackProvider>
          <RootNavigation />
        </FeedbackProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
