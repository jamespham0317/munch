import {
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts,
} from "@expo-google-fonts/quicksand";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// One QueryClient for the app's lifetime — TanStack Query layered over
// @munch/api-client per docs/08 §4. Phase 0 uses defaults; tuning lands with real
// data in Phase 1.
const queryClient = new QueryClient();

// Hold the native splash until Quicksand is ready so the first frame renders in
// the brand font, not a fallback (design-system.md §5).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Quicksand is the brand typeface (design-system.md §5); the theme adapter maps
  // each weight to one of these loaded faces.
  const [fontsLoaded] = useFonts({
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Keep the native splash up (render nothing) until the fonts resolve.
  if (!fontsLoaded) return null;

  // GestureHandlerRootView must wrap the whole app so the swipe card's pan gesture
  // (react-native-gesture-handler + reanimated) works on iOS/Android (Phase 4 polish).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        {/* Dark (charcoal) status-bar content over the cream background. */}
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
