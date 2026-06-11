"use client";

import { X } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { createPortal } from "react-dom";

/**
 * Bottom-sheet primitive (09-design-system.md §7) — a generalization of ConfirmModal's
 * scrim/dismiss machinery with a drag handle, a header (title + close), a scrollable body,
 * and an optional sticky footer. Presentational only — no data, no domain logic (CLAUDE.md
 * §4); the caller owns the open state and any mutation. Backdrop click, the header close
 * button, and Escape dismiss (unless `dismissDisabled`, e.g. while a save is in flight);
 * focus moves into the sheet on open, is trapped within it, and returns to the trigger on
 * close; body scroll is locked while open. Portaled to `body` so it escapes the page's
 * transformed/centered layout. The web twin of the mobile Sheet (RN Modal).
 */
export function Sheet({
  open,
  onDismiss,
  title,
  children,
  footer,
  dismissDisabled = false,
}: {
  open: boolean;
  onDismiss: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Block backdrop/Escape/close dismissal (e.g. while the caller's mutation runs). */
  dismissDisabled?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  // Move focus into the sheet on open, lock body scroll, and restore both on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !dismissDisabled) {
      event.stopPropagation();
      onDismiss();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        aria-hidden
        onClick={dismissDisabled ? undefined : onDismiss}
        className="absolute inset-0 bg-text/40 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative flex max-h-[85vh] w-full max-w-[480px] flex-col rounded-t-xl bg-surface shadow-active outline-none"
      >
        <div className="flex justify-center py-base">
          <div className="h-1.5 w-12 rounded-full bg-surface-highest" />
        </div>
        <div className="flex items-center justify-between border-b border-border px-md pb-sm">
          <h2 id={titleId} className="text-headline-md text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onDismiss}
            disabled={dismissDisabled}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-highest disabled:opacity-50"
          >
            <X size={24} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-md py-md">{children}</div>
        {footer ? (
          <div className="border-t border-border bg-surface px-md py-md">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
