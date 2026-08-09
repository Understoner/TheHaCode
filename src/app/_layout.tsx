import { Stack } from 'expo-router';
import { View } from 'react-native';

import { StagingBanner } from '@/components/StagingBanner';
import '@/i18n';

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      <StagingBanner />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
