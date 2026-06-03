import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { colors, spacing, typography } from "../../theme";

/**
 * Bottom tab-bar presentation primitive (design-system.md §7). PURE PRESENTATION —
 * it renders items and reports selection; the actual expo-router navigation wiring is
 * Prompt 3 (CLAUDE.md §4). The active item is brand amber. Each item supplies its own
 * icon via `renderIcon` so the bar stays icon-library-agnostic.
 */
export type TabBarItem = {
  key: string;
  label: string;
  renderIcon: (props: {
    color: string;
    size: number;
    focused: boolean;
  }) => ReactNode;
};

export function TabBar({
  items,
  activeKey,
  onSelect,
  style,
}: {
  items: TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.bar, style]} accessibilityRole="tablist">
      {items.map((item) => {
        const focused = item.key === activeKey;
        const color = focused ? colors.brand : colors.textFaint;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.label}
            style={styles.item}
          >
            {item.renderIcon({ color, size: 24, focused })}
            <Text style={[styles.label, { color }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  item: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.base,
  },
  label: { ...typography.caption },
});
