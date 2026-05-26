/**
 * Minimal design tokens for Phase 0 (docs/05-folder-structure.md §3). Intentionally
 * tiny — there is no UI system yet; this expands into a real theme in later phases.
 */
export const colors = {
  background: "#0f172a",
  surface: "#1e293b",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  accent: "#f97316",
  danger: "#f87171",
} as const;

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
} as const;
