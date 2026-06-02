import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// One QueryClient for the app's lifetime — TanStack Query layered over
// @munch/api-client per docs/08 §4. Phase 0 uses defaults; tuning lands with real
// data in Phase 1.
const queryClient = new QueryClient();

export default function RootLayout() {
  // GestureHandlerRootView must wrap the whole app so the swipe card's pan gesture
  // (react-native-gesture-handler + reanimated) works on iOS/Android (Phase 4 polish).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
