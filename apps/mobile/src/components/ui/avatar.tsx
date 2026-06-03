import { Feather } from "@expo/vector-icons";
import {
  Image,
  type ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radii, typography } from "../../theme";

/**
 * Circular avatar primitive (design-system.md §7). Presentational only
 * (CLAUDE.md §4). Shows an image, else initials, else — in the `add` variant — a
 * "+" tile for "Invite more". An optional `online` presence dot is the lobby's
 * functional presence color; the data (who is present) is supplied by the caller.
 */
export function Avatar({
  label,
  imageSource,
  online = false,
  variant = "default",
  size = 48,
}: {
  /** Initials / short label shown when there is no image. */
  label?: string;
  imageSource?: ImageSourcePropType;
  online?: boolean;
  variant?: "default" | "add";
  size?: number;
}) {
  const dimension = { width: size, height: size, borderRadius: radii.full };
  if (variant === "add") {
    return (
      <View
        style={[styles.circle, styles.add, dimension]}
        accessibilityRole="button"
        accessibilityLabel="Invite more"
      >
        <Feather name="plus" size={size * 0.45} color={colors.textMuted} />
      </View>
    );
  }
  return (
    <View style={[styles.circle, dimension]}>
      {imageSource ? (
        <Image
          source={imageSource}
          style={[styles.image, dimension]}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={styles.initials}>{label ?? ""}</Text>
      )}
      {online ? <View style={styles.onlineDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSunken,
  },
  add: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  image: { resizeMode: "cover" },
  initials: { ...typography.labelMd, color: colors.textMuted },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: radii.full,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
