import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Footer } from '@/components/Footer';
import { NavBar } from '@/components/NavBar';
import { StagingBanner } from '@/components/StagingBanner';
import { colors } from '@/design/tokens';
import { MOBILE_NAV_BREAKPOINT, MOBILE_TAB_BAR_HEIGHT } from '@/design/navigation';
import '@/i18n';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_NAV_BREAKPOINT;

  return (
    <QueryClientProvider client={queryClient}>
      {/* minHeight statt height/flex:1: react-native-web fixiert html/body auf
          exakt eine Bildschirmhoehe (position: fixed, overflow: hidden) - der
          Stack braucht flex:1 in seiner Elternkette, sonst hat sein intern
          absolut positionierter Screen-Container hoehe 0 und der komplette
          Seiteninhalt ist unsichtbar. minHeight (keine feste height) laesst
          die Seite trotzdem ueber eine Bildschirmhoehe hinaus wachsen, der
          Footer bleibt am natuerlichen Seitenende erreichbar. */}
      <View style={[styles.root, isMobile && styles.rootMobile]}>
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
    backgroundColor: colors.background,
  },
  // Reserviert Platz fuer die fixe Tab-Bar unten, sonst deckt sie den Footer zu.
  rootMobile: {
    paddingBottom: MOBILE_TAB_BAR_HEIGHT,
  },
  // Ohne contentStyle faellt expo-router auf ein Standard-Grau (#F2F2F2)
  // zurueck, sobald der Screen-Container ueberhaupt Hoehe hat.
  screen: {
    backgroundColor: colors.background,
  },
});
