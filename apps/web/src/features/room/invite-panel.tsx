"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

/**
 * Invite affordance: the 6-digit code, a copyable join link, and a QR of that
 * link. The link is built from the live origin after mount, so it works in any
 * environment and avoids an SSR/client hydration mismatch (origin is empty on the
 * server and on first client render, then filled in by the effect).
 */
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
    <section>
      <h2>Invite friends</h2>
      <p>
        Code: <strong>{code}</strong>
      </p>
      <p>
        <code>{joinUrl}</code>{" "}
        <button type="button" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy link"}
        </button>
      </p>
      <QRCodeSVG value={joinUrl} size={160} />
    </section>
  );
}
