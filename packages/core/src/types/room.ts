import type { MemberRole, PriceLevel } from "./enums";

/**
 * A private room created by a host. Fields mirror the `rooms` table
 * (docs/03-database-schema.md §3.2), mapped to camelCase at the api-client boundary.
 */
export interface Room {
  id: string;
  /** 6-digit join code. */
  code: string;
  /** Set after the host's member row exists; null at creation time. */
  hostMemberId: string | null;
  anchorLabel: string | null;
  anchorLat: number;
  anchorLng: number;
  filterOpenNow: boolean;
  filterCuisines: string[];
  filterPriceLevels: PriceLevel[];
  defaultRadiusM: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A participant in a room (guest or signed-in user). Mirrors `room_members`
 * (docs/03-database-schema.md §3.3).
 */
export interface RoomMember {
  id: string;
  roomId: string;
  /**
   * The member's auth.users id — the anonymous uid for guests, the permanent one for
   * signed-in users. Null only if that auth user was later deleted (DB `on delete set null`).
   */
  userId: string | null;
  displayName: string;
  role: MemberRole;
  joinedAt: string;
  /**
   * Set when the member leaves (or is auto-removed on disconnect). A member is an
   * ACTIVE member of the room while this is null — that set is the cohort the
   * unanimous match check, deck-exhaustion check, and ranking evaluate against
   * (CLAUDE.md §2.3, docs/02 §5). Cosmetic Here/Away is NOT a field here; it lives
   * in Realtime Presence and never affects matchmaking.
   */
  leftAt: string | null;
}

/** True iff the member is still in the room (and thus in the match cohort). */
export function isActiveMember(member: Pick<RoomMember, "leftAt">): boolean {
  return member.leftAt === null;
}
