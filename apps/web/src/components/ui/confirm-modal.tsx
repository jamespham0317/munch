"use client";

import { LogOut } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "./button";

/**
 * Confirmation modal primitive (09-design-system.md §7) — the in-app replacement for the
 * `window.confirm` on destructive actions (the room leave/end flow). The web twin of the mobile
 * ConfirmModal: a bottom-anchored sheet over a dimmed, blurred scrim with an error-container icon
 * badge, a centered headline + body, and stacked `primary` (confirm) + `neutral` (dismiss) pill
 * buttons. Presentational only — no data, no domain logic (CLAUDE.md §4); the caller owns the
 * open state and the mutation. Backdrop click and Escape dismiss; focus moves into the dialog on
 * open, is trapped within it, and returns to the trigger on close; `confirmLoading` keeps the
 * sheet open with a spinner (and blocks dismissal) while the action runs. Portaled to `body` so
 * it escapes the page's transformed/centered layout.
 */
export function ConfirmModal({
  open,
  onConfirm,
  onDismiss,
  title,
  body,
  confirmLabel,
  dismissLabel,
  confirmLoading = false,
}: {
  open: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  dismissLabel: string;
  confirmLoading?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  // Move focus into the dialog on open, lock body scroll, and restore both on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !confirmLoading) {
      event.stopPropagation();
      onDismiss();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled])",
    );
    const first = focusables?.[0];
    const last = focusables?.[focusables.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center px-gutter pb-xl">
      <div
        aria-hidden
        onClick={confirmLoading ? undefined : onDismiss}
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
      />
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative flex w-full max-w-[400px] flex-col gap-md rounded-lg bg-surface p-md shadow-active outline-none"
      >
        <div className="flex h-16 w-16 items-center justify-center self-center rounded-full bg-error-container text-error shadow-low">
          <LogOut size={32} aria-hidden />
        </div>
        <div className="flex flex-col gap-base text-center">
          <h2 id={titleId} className="text-headline-md text-text">
            {title}
          </h2>
          <p id={bodyId} className="text-body-md text-text-muted">
            {body}
          </p>
        </div>
        <div className="flex flex-col gap-base">
          <Button
            label={confirmLabel}
            variant="primary"
            onClick={onConfirm}
            loading={confirmLoading}
          />
          <Button
            label={dismissLabel}
            variant="neutral"
            onClick={onDismiss}
            disabled={confirmLoading}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
