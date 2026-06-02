import { describe, expect, it } from "vitest";

import {
  passwordResetRequestSchema,
  registerRequestSchema,
  signInRequestSchema,
  updatePasswordRequestSchema,
} from "./auth";

describe("registerRequestSchema", () => {
  it("accepts a valid email/password/display_name trio", () => {
    const result = registerRequestSchema.safeParse({
      email: "jo@example.com",
      password: "hunter2!secret",
      display_name: "Jo",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 chars", () => {
    const result = registerRequestSchema.safeParse({
      email: "jo@example.com",
      password: "short",
      display_name: "Jo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = registerRequestSchema.safeParse({
      email: "not-an-email",
      password: "hunter2!secret",
      display_name: "Jo",
    });
    expect(result.success).toBe(false);
  });
});

describe("signInRequestSchema", () => {
  it("requires both email and password", () => {
    expect(
      signInRequestSchema.safeParse({ email: "jo@example.com" }).success,
    ).toBe(false);
    expect(
      signInRequestSchema.safeParse({ password: "hunter2!secret" }).success,
    ).toBe(false);
    expect(
      signInRequestSchema.safeParse({
        email: "jo@example.com",
        password: "hunter2!secret",
      }).success,
    ).toBe(true);
  });
});

describe("passwordResetRequestSchema", () => {
  it("requires a valid email", () => {
    expect(
      passwordResetRequestSchema.safeParse({ email: "jo@example.com" }).success,
    ).toBe(true);
    expect(
      passwordResetRequestSchema.safeParse({ email: "nope" }).success,
    ).toBe(false);
  });
});

describe("updatePasswordRequestSchema", () => {
  it("enforces the 8-char password floor", () => {
    expect(
      updatePasswordRequestSchema.safeParse({ password: "hunter2!secret" })
        .success,
    ).toBe(true);
    expect(
      updatePasswordRequestSchema.safeParse({ password: "short" }).success,
    ).toBe(false);
  });
});
