import type { ReactNode, RefObject } from "react";
import {
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../theme";

/** Which safe-area insets this screen pads. Top-only is the app default — the bottom
 *  tab bar owns its own `insets.bottom` (10-pages.md §2), so screens never add it. */
type ScreenEdge = "top" | "bottom";

/**
 * Screen scaffold (09-design-system.md §7) — the cream page container every route wrapper
 * shares: the `background` fill, the 20px screen margin + `md` inter-block gap, and the
 * **safe-area top inset** so content clears the iOS status bar / Dynamic Island (and notched
 * Android). Presentational only — no data, no domain logic (CLAUDE.md §4); the route stays a
 * thin pass-through into its feature view.
 *
 * `scroll` (default) renders a `ScrollView`, so the inset lives on the content container and
 * scrolls correctly; `scroll={false}` renders a `flex: 1` View for centered/static screens.
 * `padded` (default) applies the screen margin + gap; a screen with bespoke interior padding
 * (e.g. the centered Discover placeholder) passes `padded={false}` and supplies its own via
 * `contentStyle`. `edges` defaults to top-only and is kept configurable for future use.
 *
 * `scrollRef` is forwarded to the internal `ScrollView` so a screen can drive its scroll
 * position — e.g. Create Room scrolling to the top (the name field) on an empty-name submit.
 * Ignored when `scroll={false}` (no ScrollView to attach to).
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ["top"],
  style,
  contentStyle,
  keyboardShouldPersistTaps = "handled",
  scrollRef,
}: {
  children: ReactNode;
  /** `false` renders a static `flex: 1` View instead of a ScrollView. */
  scroll?: boolean;
  /** Apply the standard screen margin + `md` gap. Off for screens with custom padding. */
  padded?: boolean;
  /** Safe-area insets to pad. Defaults to `["top"]`; the tab bar owns the bottom. */
  edges?: readonly ScreenEdge[];
  /** Outer container style (ScrollView / View). */
  style?: StyleProp<ViewStyle>;
  /** Content style (contentContainerStyle when scrolling; merged into the View otherwise). */
  contentStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
  /** Ref to the internal ScrollView, to drive scroll position. No-op when `scroll={false}`. */
  scrollRef?: RefObject<ScrollView | null>;
}) {
  // The inset clears the status bar / Dynamic Island; when padded, the 20px screen margin
  // rides on top of it so content keeps its normal breathing room below the island.
  const insets = useSafeAreaInsets();
  const margin = padded ? spacing.screenMarginMobile : 0;
  const inset: ViewStyle = {
    paddingTop: (edges.includes("top") ? insets.top : 0) + margin,
    paddingBottom: (edges.includes("bottom") ? insets.bottom : 0) + margin,
  };

  const content: StyleProp<ViewStyle> = [
    padded && styles.padded,
    inset,
    contentStyle,
  ];

  if (!scroll) {
    return <View style={[styles.screenFlex, content, style]}>{children}</View>;
  }
  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.screen, style]}
      contentContainerStyle={content}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  screenFlex: { flex: 1, backgroundColor: colors.background },
  // Horizontal margin + gap only; the vertical padding comes from the dynamic inset so it
  // can fold the safe-area inset into the top value (paddingTop would otherwise override it).
  padded: { paddingHorizontal: spacing.screenMarginMobile, gap: spacing.md },
});
