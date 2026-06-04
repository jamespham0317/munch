/**
 * Barrel for the web UI primitive library (09-design-system.md §7). Every primitive is
 * presentational only and built from the Tailwind theme — which is seeded from
 * @munch/ui — with no business logic, no hooks, and no @munch/core domain rules
 * (CLAUDE.md §4). They mirror the Phase B mobile primitives' API and look, implemented
 * for the DOM (no react-native-web). RadiusSlider lives at ../radius-slider (the
 * existing functional component, restyled in place).
 */
export { Avatar } from "./avatar";
export { Button } from "./button";
export { Card } from "./card";
export { Chip, FoodChip } from "./chip";
export { Field } from "./field";
export { Input } from "./input";
export { PriceTile, SegmentedTile } from "./price-tile";
export { Badge, ProgressPill } from "./progress-pill";
export { TabBar, type TabBarItem } from "./tab-bar";
export { Toggle } from "./toggle";
