/**
 * Discover tab placeholder (10-pages.md §3.9). A browse/discovery feed is post-v1 (docs/07 §8);
 * v1 is room-based, so this ships as a styled "coming soon" state so the tab isn't empty.
 * Presentation only — no data, no hooks (CLAUDE.md §4). The web twin of the mobile Discover
 * screen and the "Discover - Under Construction" Stitch mockup: a soft amber/heat glow behind
 * a large neutral circle flanked by a heat and a brand dot.
 */
export default function DiscoverPage() {
  return (
    <section className="relative flex min-h-[70vh] flex-col items-center justify-center px-lg text-center">
      {/* Decorative warm glow behind the circle cluster (09-design-system.md §4). */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-80 w-80 -translate-y-24 translate-x-16 rounded-full bg-heat opacity-20 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-65 w-65 -translate-x-20 -translate-y-10 rounded-full bg-brand opacity-20 blur-2xl"
      />

      <div aria-hidden className="relative mb-md h-46 w-46">
        <div className="absolute inset-0 rounded-full bg-surface-raised" />
        <span className="absolute right-0 top-1 h-12 w-12 rounded-full bg-heat" />
        <span className="absolute bottom-2 left-2 h-10 w-10 rounded-full bg-brand" />
      </div>

      <h1 className="text-headline-md text-text">Under Construction</h1>
      <p className="mt-sm max-w-80 text-body-md text-text-muted">
        We&apos;re cooking up something special. Check back soon for more ways
        to find great food!
      </p>
    </section>
  );
}
