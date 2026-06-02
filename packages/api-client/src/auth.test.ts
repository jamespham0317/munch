import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  ensureProfile,
  registerWithEmailPassword,
  requestPasswordReset,
  signInWithEmailPassword,
  signInWithGoogle,
  updatePassword,
} from "./auth";

/**
 * Unit tests for the Phase-4.5 account-auth boundary (docs/04 §2; CLAUDE.md §3). No real auth
 * server — the Supabase Auth SDK is stubbed. The contracts under test:
 *   * a failed sign-in maps to a SAFE ApiError (UNAUTHENTICATED) with the canonical message,
 *     never the raw GoTrue text (which can echo an email);
 *   * register surfaces needsEmailConfirmation when signUp returns no session, and writes no
 *     profile (there is no session yet);
 *   * ensureProfile refuses while the user is anonymous (guests stay profile-less) and otherwise
 *     resolves the display name from user_metadata.
 */

/** A GoTrue auth error as errors.ts duck-types it (`__isAuthError` + optional `status`). */
function authError(message: string, status?: number): unknown {
  return { __isAuthError: true, status, message, name: "AuthApiError" };
}

/** Build a SupabaseClient whose `auth` methods resolve to the given canned values. */
function authClient(auth: Partial<SupabaseClient["auth"]>): SupabaseClient {
  return { auth } as unknown as SupabaseClient;
}

describe("registerWithEmailPassword", () => {
  it("reports needsEmailConfirmation when signUp returns no session", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    });
    const result = await registerWithEmailPassword(authClient({ signUp }), {
      email: "a@b.com",
      password: "password123",
      displayName: "Ada",
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ needsEmailConfirmation: true });
    // The chosen name rides in user metadata so it survives the confirmation round-trip.
    expect(signUp).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "password123",
      options: { data: { display_name: "Ada" } },
    });
  });

  it("reports no confirmation needed when a session is returned", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "t" } },
      error: null,
    });
    const result = await registerWithEmailPassword(authClient({ signUp }), {
      email: "a@b.com",
      password: "password123",
      displayName: "Ada",
    });
    expect(result.data).toEqual({ needsEmailConfirmation: false });
  });
});

describe("signInWithEmailPassword", () => {
  it("maps a bad-credentials auth error to a safe UNAUTHENTICATED ApiError", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: null },
      error: authError("Invalid login credentials: a@b.com"),
    });
    const result = await signInWithEmailPassword(
      authClient({ signInWithPassword }),
      { email: "a@b.com", password: "wrong-password" },
    );
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("UNAUTHENTICATED");
    // Never the raw text (which echoed the email).
    expect(result.error?.error.message).not.toContain("a@b.com");
  });

  it("returns the session on success", async () => {
    const session = { access_token: "t" } as unknown as Session;
    const signInWithPassword = vi
      .fn()
      .mockResolvedValue({ data: { session }, error: null });
    const result = await signInWithEmailPassword(
      authClient({ signInWithPassword }),
      { email: "a@b.com", password: "password123" },
    );
    expect(result.error).toBeNull();
    expect(result.data).toBe(session);
  });
});

describe("signInWithGoogle", () => {
  it("returns the provider authorization URL", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: "google", url: "https://accounts.google.com/auth" },
      error: null,
    });
    const result = await signInWithGoogle(authClient({ signInWithOAuth }), {
      redirectTo: "munch://auth/callback",
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ url: "https://accounts.google.com/auth" });
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "munch://auth/callback",
        skipBrowserRedirect: true,
      },
    });
  });
});

describe("requestPasswordReset / updatePassword", () => {
  it("maps a reset failure to a safe ApiError", async () => {
    const resetPasswordForEmail = vi
      .fn()
      .mockResolvedValue({ error: authError("nope") });
    const result = await requestPasswordReset(
      authClient({ resetPasswordForEmail }),
      { email: "a@b.com", redirectTo: "munch://auth/reset" },
    );
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("UNAUTHENTICATED");
  });

  it("updates the password on the recovery session", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const result = await updatePassword(authClient({ updateUser }), {
      password: "new-password",
    });
    expect(result.error).toBeNull();
    expect(updateUser).toHaveBeenCalledWith({ password: "new-password" });
  });
});

describe("ensureProfile", () => {
  it("refuses (FORBIDDEN) while the user is anonymous — guests stay profile-less", async () => {
    const anon = { id: "g1", is_anonymous: true } as unknown as User;
    const getUser = vi
      .fn()
      .mockResolvedValue({ data: { user: anon }, error: null });
    // `from` must never be reached for a guest.
    const from = vi.fn();
    const client = {
      auth: { getUser },
      from,
    } as unknown as SupabaseClient;
    const result = await ensureProfile(client, "Ada");
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("FORBIDDEN");
    expect(from).not.toHaveBeenCalled();
  });

  it("upserts the profile using the display name from user_metadata", async () => {
    const user = {
      id: "u1",
      is_anonymous: false,
      user_metadata: { full_name: "Grace Hopper" },
    } as unknown as User;
    const getUser = vi.fn().mockResolvedValue({ data: { user }, error: null });
    const upsert = vi.fn().mockReturnValue({
      select: () => ({
        single: () => ({
          returns: () =>
            Promise.resolve({
              data: {
                id: "u1",
                display_name: "Grace Hopper",
                created_at: "2026-06-02T00:00:00Z",
                updated_at: "2026-06-02T00:00:00Z",
              },
              error: null,
            }),
        }),
      }),
    });
    const client = {
      auth: { getUser },
      from: vi.fn().mockReturnValue({ upsert }),
    } as unknown as SupabaseClient;
    const result = await ensureProfile(client, "fallback-name");
    expect(result.error).toBeNull();
    expect(result.data?.displayName).toBe("Grace Hopper");
    // Metadata wins over the fallback arg.
    expect(upsert).toHaveBeenCalledWith({
      id: "u1",
      display_name: "Grace Hopper",
    });
  });
});
