import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Footer } from '@/components/Footer';
import { NavBar } from '@/components/NavBar';
import { StagingBanner } from '@/components/StagingBanner';
import '@/i18n';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {/* Kein flex:1 auf dem Wurzelelement: die Seite soll wie eine normale
          Webseite in natuerlicher Hoehe fliessen, sonst zwingt der Stack
          (flex:1 innen) die Seite auf exakt eine Bildschirmhoehe und der
          Footer wird nie erreichbar. */}
      <View>
        <StagingBanner />
        <NavBar />
        <Stack screenOptions={{ headerShown: false }} />
        <Footer />
      </View>
    </QueryClientProvider>
  );
}
