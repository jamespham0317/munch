export * from "./tokens";

import type { colors, radii, shadows, spacing, typography } from "./tokens";

/** A semantic color role name (e.g. `"brand"`, `"surfaceRaised"`). */
export type ColorRole = keyof typeof colors;
/** A type-style name (e.g. `"titleLg"`, `"caption"`). */
export type TypographyStyle = keyof typeof typography;
/** A spacing / layout token name. */
export type SpacingToken = keyof typeof spacing;
/** A corner-radius token name. */
export type RadiusToken = keyof typeof radii;
/** A shadow token name. */
export type ShadowToken = keyof typeof shadows;
