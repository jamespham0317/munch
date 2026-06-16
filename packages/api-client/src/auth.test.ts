import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  ensureProfile,
  fetchOwnProfile,
  registerWithEmailPassword,
  requestPasswordReset,
  signInWithEmailPassword,
  signInWithGoogle,
  signOut,
  updatePassword,
} from "./auth";

/**
 * Unit tests for the Phase-4.5 account-auth boundary (docs/04 §2; CLAUDE.md §3). No real auth
 * server — the Supabase Auth SDK is stubbed. The contracts under test:
 *   * a wrong-password sign-in maps to a SAFE INVALID_CREDENTIALS ApiError, and sign-up with an
 *     existing email to EMAIL_EXISTS — never the raw GoTrue text (which can echo an email);
 *   * register surfaces needsEmailConfirmation when signUp returns no session, and writes no
 *     profile (there is no session yet);
 *   * ensureProfile refuses while the user is anonymous (guests stay profile-less) and otherwise
 *     resolves the display name from user_metadata.
 */

/** A GoTrue auth error as errors.ts duck-types it (`__isAuthError` + optional `status`/`code`). */
function authError(
  message: string,
  opts?: { status?: number; code?: string },
): unknown {
  return {
    __isAuthError: true,
    status: opts?.status,
    code: opts?.code,
    message,
    name: "AuthApiError",
  };
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

  it("maps an already-registered email to a safe EMAIL_EXISTS ApiError", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: authError("User already registered: a@b.com", {
        status: 422,
        code: "user_already_exists",
      }),
    });
    const result = await registerWithEmailPassword(authClient({ signUp }), {
      email: "a@b.com",
      password: "password123",
      displayName: "Ada",
    });
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("EMAIL_EXISTS");
    // Never the raw text (which echoed the email).
    expect(result.error?.error.message).not.toContain("a@b.com");
  });
});

describe("signInWithEmailPassword", () => {
  it("maps a wrong-password auth error to a safe INVALID_CREDENTIALS ApiError", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: null },
      error: authError("Invalid login credentials: a@b.com", {
        status: 400,
        code: "invalid_credentials",
      }),
    });
    const result = await signInWithEmailPassword(
      authClient({ signInWithPassword }),
      { email: "a@b.com", password: "wrong-password" },
    );
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("INVALID_CREDENTIALS");
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

describe("signOut", () => {
  it("returns no error on a clean sign-out", async () => {
    const signOutFn = vi.fn().mockResolvedValue({ error: null });
    const result = await signOut(authClient({ signOut: signOutFn }));
    expect(result.error).toBeNull();
    expect(signOutFn).toHaveBeenCalledTimes(1);
  });

  it("maps a sign-out failure to a safe ApiError, never raw text", async () => {
    const signOutFn = vi
      .fn()
      .mockResolvedValue({ error: authError("network down") });
    const result = await signOut(authClient({ signOut: signOutFn }));
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("UNAUTHENTICATED");
    expect(result.error?.error.message).not.toContain("network down");
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

describe("fetchOwnProfile", () => {
  /** Build a client whose `from("profiles").select(...).maybeSingle().returns()` resolves. */
  function profileClient(row: unknown, error: unknown = null): SupabaseClient {
    const returns = vi.fn().mockResolvedValue({ data: row, error });
    const maybeSingle = vi.fn().mockReturnValue({ returns });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    return {
      from: vi.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient;
  }

  it("maps the caller's own profile row to camelCase", async () => {
    const result = await fetchOwnProfile(
      profileClient({
        id: "u1",
        display_name: "Ada Lovelace",
        created_at: "2026-06-02T00:00:00Z",
        updated_at: "2026-06-02T00:00:00Z",
      }),
    );
    expect(result.error).toBeNull();
    expect(result.data?.displayName).toBe("Ada Lovelace");
  });

  it("returns null data (no error) when there is no profile row — a guest", async () => {
    const result = await fetchOwnProfile(profileClient(null));
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it("maps a read failure to a safe ApiError, never raw DB text", async () => {
    const result = await fetchOwnProfile(
      profileClient(null, {
        code: "42501",
        details: "",
        hint: "",
        message: "rls",
      }),
    );
    expect(result.data).toBeNull();
    expect(result.error?.error.code).toBe("FORBIDDEN");
  });
});
