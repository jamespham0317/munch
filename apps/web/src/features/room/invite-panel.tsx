"use client";

import { Check, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

/**
 * Invite affordance (pages.md §3.5, "Lobby with QR Code"): the amber code card with the
 * 6-digit code, a scannable QR of the join link, and tap-to-copy. The link is built from the
 * live origin after mount, so it works in any environment and avoids an SSR/client hydration
 * mismatch (origin is empty on the server and on first client render, then filled in by the
 * effect) and routes to /room/join/{code}. Presentational; the code is passed in
 * (CLAUDE.md §4). Web twin of the Phase B mobile InvitePanel.
 */

/** Shared join-link builder so the lobby's "Invite more" share uses the same URL as the QR. */
export function buildJoinUrl(code: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/room/join/${code}`;
}

/** Display the 6-digit code as `123-456` for readability; the stored value is unchanged. */
function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

export function InvitePanel({ code }: { code: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const joinUrl = `${origin}/room/join/${code}`;

  function handleCopy() {
    void navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy join link"
      className="flex w-full flex-col items-center gap-gutter rounded-xl bg-brand p-md text-on-brand shadow-low transition-transform active:translate-y-[var(--munch-press-translate-y)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
    >
      <span className="text-display-lg-mobile tracking-[0.25em] text-on-brand">
        {formatCode(code)}
      </span>
      <span className="rounded-md bg-surface p-base">
        <QRCodeSVG value={joinUrl} size={140} />
      </span>
      <span className="flex items-center gap-base text-label-md uppercase text-on-brand">
        {copied ? (
          <Check size={14} aria-hidden />
        ) : (
          <Copy size={14} aria-hidden />
        )}
        {copied ? "Link copied!" : "Tap to copy link or scan QR"}
      </span>
    </button>
  );
}
