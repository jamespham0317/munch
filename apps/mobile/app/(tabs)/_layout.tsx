import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabBar, type TabBarItem } from "../../src/components/ui";

/**
 * Bottom-tab shell (10-pages.md §2): Discover · Match · Profile. Wires expo-router's
 * Tabs to the presentational TabBar primitive (09-design-system.md §7) — the primitive
 * owns no navigation logic, so this adapter maps router state onto its
 * items/activeKey/onSelect contract. Room-flow screens (room/*) live in the root
 * Stack and present full-screen ABOVE these tabs (10-pages.md §2).
 */

// Three tabs in a fixed order regardless of any single mockup's two-tab bar
// (10-pages.md §2). Each route name maps to a Feather glyph + label; the icons match
// the Stitch mockups (Match = heart, Profile = person).
const TAB_META: Record<
  string,
  { label: string; icon: ComponentProps<typeof Feather>["name"] }
> = {
  discover: { label: "Discover", icon: "compass" },
  index: { label: "Match", icon: "heart" },
  history: { label: "Profile", icon: "user" },
};

export default function TabsLayout() {
  // Pad the bar past the home indicator without baking the inset into the
  // presentation primitive (which stays device-agnostic, 09-design-system.md §7).
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => {
        const activeKey = state.routes[state.index]?.name ?? "";
        const items: TabBarItem[] = state.routes.flatMap((route) => {
          const meta = TAB_META[route.name];
          if (!meta) return [];
          return [
            {
              key: route.name,
              label: meta.label,
              renderIcon: ({ color, size }) => (
                <Feather name={meta.icon} size={size} color={color} />
              ),
            },
          ];
        });
        return (
          <TabBar
            items={items}
            activeKey={activeKey}
            onSelect={(key) => {
              // Translate a tap into the router's tabPress flow so the default
              // navigation guard (already-focused / preventDefault) is honored.
              const route = state.routes.find((r) => r.name === key);
              if (!route) return;
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (key !== activeKey && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={{ paddingBottom: insets.bottom }}
          />
        );
      }}
    >
      {/* Explicit order sets the tab display order: Discover · Match · Profile. */}
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
    </Tabs>
  );
}
