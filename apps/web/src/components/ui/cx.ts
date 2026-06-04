/**
 * Tiny className joiner — filters out falsy values so conditional Tailwind classes
 * read cleanly (`cx(base, selected && "bg-brand")`). Kept dependency-free on purpose:
 * the primitives only need to compose token-backed utility classes, not the
 * clsx/tailwind-merge machinery (11-ui-roadmap.md §7 "add no new dep").
 */
export function cx(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
