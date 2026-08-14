import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Footer } from '@/components/Footer';
import { NavBar } from '@/components/NavBar';
import { StagingBanner } from '@/components/StagingBanner';
import { colors } from '@/design/tokens';
import { responsive } from '@/design/responsive';
import '@/i18n';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const { t } = useTranslation();
  const pathname = usePathname();

  // Der Player laeuft im Vollbild: waehrend einer Uebung soll nichts
  // ablenken und nichts versehentlich wegfuehren, der Ausstieg geht nur ueber
  // "Beenden" (BACKLOG T11). Betroffen ist nur /sessions/<id>, nicht die
  // Liste darueber. Ohne Navigation entfaellt auch der reservierte Platz fuer
  // die Tab-Leiste, sonst bliebe unten ein leerer Streifen stehen.
  const immersive = /^\/sessions\/.+/.test(pathname);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Der Titel gehoert hierher und nicht in +html.tsx: Expo rendert den
          <title> ueber react-helmet, und nur ueber <Head> gesetzt aendert er
          sich auch beim Wechsel der Seite ohne Neuladen. Einzelne Screens
          koennen ihn spaeter mit demselben Bauteil ueberschreiben. */}
      <Head>
        <title>{t('meta.title')}</title>
        <meta name="description" content={t('meta.description')} />
      </Head>
      {/* minHeight statt height/flex:1: react-native-web fixiert html/body auf
          exakt eine Bildschirmhoehe (position: fixed, overflow: hidden) - der
          Stack braucht flex:1 in seiner Elternkette, sonst hat sein intern
          absolut positionierter Screen-Container hoehe 0 und der komplette
          Seiteninhalt ist unsichtbar. minHeight (keine feste height) laesst
          die Seite trotzdem ueber eine Bildschirmhoehe hinaus wachsen, der
          Footer bleibt am natuerlichen Seitenende erreichbar. */}
      <View {...(immersive ? {} : responsive('page-root'))} style={styles.root}>
        {immersive ? null : (
          <>
            <StagingBanner />
            <NavBar />
          </>
        )}
        <Stack screenOptions={{ headerShown: false, contentStyle: styles.screen }} />
        {immersive ? null : <Footer />}
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: '100%',
    backgroundColor: colors.background,
  },
  // Den Platz fuer die fixe Tab-Leiste unten reserviert die Media Query in
  // src/design/responsive.ts ('page-root') - dort steht auch, warum das nicht
  // mehr ueber eine in JavaScript gemessene Fensterbreite laeuft.
  // Ohne contentStyle faellt expo-router auf ein Standard-Grau (#F2F2F2)
  // zurueck, sobald der Screen-Container ueberhaupt Hoehe hat.
  screen: {
    backgroundColor: colors.background,
  },
});
