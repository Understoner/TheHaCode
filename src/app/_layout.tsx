import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Footer } from '@/components/Footer';
import { NavBar } from '@/components/NavBar';
import { StagingBanner } from '@/components/StagingBanner';
import { colors } from '@/design/tokens';
import '@/i18n';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {/* minHeight statt height/flex:1: react-native-web fixiert html/body auf
          exakt eine Bildschirmhoehe (position: fixed, overflow: hidden) - der
          Stack braucht flex:1 in seiner Elternkette, sonst hat sein intern
          absolut positionierter Screen-Container hoehe 0 und der komplette
          Seiteninhalt ist unsichtbar. minHeight (keine feste height) laesst
          die Seite trotzdem ueber eine Bildschirmhoehe hinaus wachsen, der
          Footer bleibt am natuerlichen Seitenende erreichbar. */}
      <View style={styles.root}>
        <StagingBanner />
        <NavBar />
        <Stack screenOptions={{ headerShown: false, contentStyle: styles.screen }} />
        <Footer />
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: '100%',
  },
  // Ohne contentStyle faellt expo-router auf ein Standard-Grau (#F2F2F2)
  // zurueck, sobald der Screen-Container ueberhaupt Hoehe hat.
  screen: {
    backgroundColor: colors.background,
  },
});
