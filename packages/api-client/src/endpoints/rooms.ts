import type {
  ApiError,
  CreateRoomRequest,
  JoinRoomRequest,
  MemberRole,
  PriceLevel,
  Room,
  RoomMember,
  UpdateRoomFiltersRequest,
} from "@munch/core";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { type ClientResult, toApiError } from "../errors";

/**
 * Shape of an awaited `client.rpc(...)` result. Without generated DB types the RPC return is
 * typed `any`, so each call casts to this with its documented snake_case payload (the RPC
 * return shapes are pinned in 0005) before mapping — keeping `any` out of app-facing code.
 */
type RpcResult<T> = { data: T | null; error: PostgrestError | null };

/**
 * Room + membership endpoints (docs/04 §3.1–§3.4, §3.10). This is the only place that knows
 * endpoint names/shapes (CLAUDE.md §4). Privileged writes that cross an RLS boundary go
 * through the security-definer RPCs (create_room / join_room / update_room_filters from 0005;
 * leave_room from 0018). leave_room must read ALL members' swipes and write matches/sessions
 * for the immediate membership recheck (Phase 4.7), so it is a security-definer RPC, not a
 * client write. End-room is the host close — a direct RLS-scoped `rooms` write
 * (rooms_update_host, 0003) plus cancel_active_session (0011). Cosmetic Here/Away is NOT a DB
 * write any more — it lives in Realtime Presence (see realtime.ts); only the authoritative
 * liveness heartbeat (`member_heartbeats`, 0017) is written here.
 *
 * Results map snake_case → camelCase here, the api-client boundary (docs/06 §5). The
 * snake_case wire contract (request bodies, RPC return shapes) lives in @munch/core validation;
 * these `*Result` types are the camelCase shapes app code consumes.
 */

// --- camelCase result shapes returned to app code ---------------------------

export interface CreateRoomResult {
  room: Pick<Room, "id" | "code">;
  member: Pick<RoomMember, "id" | "role" | "displayName">;
}

export interface JoinRoomResult {
  room: Pick<Room, "id" | "code" | "anchorLabel">;
  member: Pick<RoomMember, "id" | "role" | "displayName">;
  members: Pick<RoomMember, "id" | "displayName" | "role">[];
}

export interface UpdateRoomFiltersResult {
  room: Pick<
    Room,
    | "id"
    | "anchorLabel"
    | "anchorLat"
    | "anchorLng"
    | "filterOpenNow"
    | "filterCuisines"
    | "filterPriceLevels"
    | "defaultRadiusM"
  >;
}

export interface LeaveRoomResult {
  member: Pick<RoomMember, "id" | "leftAt">;
  /**
   * True when leaving closed the room: the caller was the host (resolved host-leave policy,
   * no transfer) OR they were the last active member (the room empties → cancelled + closed).
   */
  roomEnded: boolean;
}

export interface EndRoomResult {
  room: Pick<Room, "id" | "isActive">;
}

// --- raw (snake_case) RPC return shapes -------------------------------------
// No generated DB types yet, so the jsonb returned by each RPC is typed explicitly.

interface RawCreateRoomResponse {
  room: { id: string; code: string };
  member: { id: string; role: MemberRole; display_name: string };
}

interface RawJoinRoomResponse {
  room: { id: string; code: string; anchor_label: string | null };
  member: { id: string; role: MemberRole; display_name: string };
  members: {
    id: string;
    display_name: string;
    role: MemberRole;
  }[];
}

interface RawUpdateRoomFiltersResponse {
  room: {
    id: string;
    anchor_label: string | null;
    anchor_lat: number;
    anchor_lng: number;
    filters: {
      open_now: boolean;
      cuisines: string[];
      price_levels: PriceLevel[];
    };
    default_radius_m: number;
  };
}

// --- privileged RPCs (security definer; cross an RLS boundary) ---------------

/** create_room (docs/04 §3.1): generates the code, creates the host member, links the room. */
export async function createRoom(
  client: SupabaseClient,
  req: CreateRoomRequest,
): Promise<ClientResult<CreateRoomResult>> {
  const { data: raw, error } = (await client.rpc("create_room", {
    p_host_display_name: req.host_display_name,
    p_anchor_label: req.anchor_label,
    p_anchor_lat: req.anchor_lat,
    p_anchor_lng: req.anchor_lng,
    p_filter_open_now: req.filters.open_now,
    p_filter_cuisines: req.filters.cuisines,
    p_filter_price_levels: req.filters.price_levels,
    p_default_radius_m: req.default_radius_m,
  })) as RpcResult<RawCreateRoomResponse>;
  if (error || !raw) {
    return { data: null, error: toApiError(error) };
  }
  return {
    data: {
      room: { id: raw.room.id, code: raw.room.code },
      member: {
        id: raw.member.id,
        role: raw.member.role,
        displayName: raw.member.display_name,
      },
    },
    error: null,
  };
}

/** join_room (docs/04 §3.2): joins by code; returns the room, the new member, and co-members. */
export async function joinRoom(
  client: SupabaseClient,
  req: JoinRoomRequest,
): Promise<ClientResult<JoinRoomResult>> {
  const { data: raw, error } = (await client.rpc("join_room", {
    p_code: req.code,
    p_display_name: req.display_name,
  })) as RpcResult<RawJoinRoomResponse>;
  if (error || !raw) {
    return { data: null, error: toApiError(error) };
  }
  return {
    data: {
      room: {
        id: raw.room.id,
        code: raw.room.code,
        anchorLabel: raw.room.anchor_label,
      },
      member: {
        id: raw.member.id,
        role: raw.member.role,
        displayName: raw.member.display_name,
      },
      members: raw.members.map((m) => ({
        id: m.id,
        displayName: m.display_name,
        role: m.role,
      })),
    },
    error: null,
  };
}

/**
 * update_room_filters (docs/04 §3.3, host only). `roomId` is explicit (a host may host more
 * than one room) and is not part of the request body. Only provided fields change; an omitted
 * field is sent as null, which the RPC reads as "unchanged".
 */
export async function updateRoomFilters(
  client: SupabaseClient,
  roomId: string,
  req: UpdateRoomFiltersRequest,
): Promise<ClientResult<UpdateRoomFiltersResult>> {
  const { data: raw, error } = (await client.rpc("update_room_filters", {
    p_room_id: roomId,
    p_anchor_label: req.anchor_label ?? null,
    p_anchor_lat: req.anchor_lat ?? null,
    p_anchor_lng: req.anchor_lng ?? null,
    p_filter_open_now: req.filters?.open_now ?? null,
    p_filter_cuisines: req.filters?.cuisines ?? null,
    p_filter_price_levels: req.filters?.price_levels ?? null,
    p_default_radius_m: req.default_radius_m ?? null,
  })) as RpcResult<RawUpdateRoomFiltersResponse>;
  if (error || !raw) {
    return { data: null, error: toApiError(error) };
  }
  return {
    data: {
      room: {
        id: raw.room.id,
        anchorLabel: raw.room.anchor_label,
        anchorLat: raw.room.anchor_lat,
        anchorLng: raw.room.anchor_lng,
        filterOpenNow: raw.room.filters.open_now,
        filterCuisines: raw.room.filters.cuisines,
        filterPriceLevels: raw.room.filters.price_levels,
        defaultRadiusM: raw.room.default_radius_m,
      },
    },
    error: null,
  };
}

// --- membership lifecycle ---------------------------------------------------

/** Raw jsonb returned by the leave_room RPC (0018). */
interface RawLeaveRoomResponse {
  member: { id: string; left_at: string | null };
  room_ended: boolean;
}

/**
 * leave_room (docs/04 §3.10): member self-leave via the security-definer RPC (0018). The RPC
 * sets the caller's own `left_at`, DELETES that member's swipes for the room's non-terminal
 * sessions (so they truly stop counting — CLAUDE.md §3), then:
 *   • host leave → cancel any non-terminal session + soft-close the room (resolved host-leave
 *     policy; host role is NOT transferred — CLAUDE.md invariant 3);
 *   • non-host leave → if it empties the active cohort the session is cancelled and the room
 *     closes; otherwise the remaining active members are re-checked and an immediate match is
 *     declared if their existing likes are now unanimous (Phase 4.7, roadmap §6.7).
 * All of that is server-authoritative and transactional — the client only reports the outcome.
 * Bare-code errors (UNAUTHENTICATED / FORBIDDEN) map through toApiError.
 */
export async function leaveRoom(
  client: SupabaseClient,
  roomId: string,
): Promise<ClientResult<LeaveRoomResult>> {
  const { data: raw, error } = (await client.rpc("leave_room", {
    p_room_id: roomId,
  })) as RpcResult<RawLeaveRoomResponse>;
  if (error || !raw) {
    return { data: null, error: toApiError(error) };
  }
  return {
    data: {
      member: { id: raw.member.id, leftAt: raw.member.left_at },
      roomEnded: raw.room_ended,
    },
    error: null,
  };
}

/**
 * Write the caller's authoritative liveness heartbeat (`member_heartbeats`, 0017). Upserts
 * `{ member_id, last_seen_at: now() }` under RLS (the policy scopes the write to a member row
 * the caller owns). Fire-and-forget: the loop in the room surfaces calls this every
 * HEARTBEAT_INTERVAL_S; if it lapses past MEMBER_ABSENCE_GRACE_S the sweeper (prune_absent_members,
 * 0018) auto-removes the member. The table is NOT in the realtime publication and is never read
 * by clients — only the security-definer sweeper reads it.
 */
export async function heartbeat(
  client: SupabaseClient,
  memberId: string,
): Promise<ClientResult<void>> {
  const { error } = await client
    .from("member_heartbeats")
    .upsert(
      { member_id: memberId, last_seen_at: new Date().toISOString() },
      { onConflict: "member_id" },
    );
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  return { data: undefined, error: null };
}

/**
 * end_room (docs/04 §3.10, host): soft-close the room (RLS rooms_update_host gates this) and
 * cancel any non-terminal session via cancel_active_session (0011). The session-cancel step
 * is a no-op when there isn't one.
 */
export async function endRoom(
  client: SupabaseClient,
  roomId: string,
): Promise<ClientResult<EndRoomResult>> {
  const { data, error } = await client
    .from("rooms")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .select("id, is_active")
    .single()
    .returns<{ id: string; is_active: boolean }>();
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  const cancelError = await cancelActiveSession(client, roomId);
  if (cancelError) {
    return { data: null, error: cancelError };
  }
  return {
    data: { room: { id: data.id, isActive: data.is_active } },
    error: null,
  };
}

/**
 * Helper — call cancel_active_session (0011) for the host-leave / end-room paths. Returns the
 * mapped ApiError on failure, or null on success (incl. the no-op case where there is no
 * non-terminal session). NOT_HOST should not occur on these paths (the caller is the host by
 * the time we get here) but we surface it cleanly via toApiError if it does.
 */
async function cancelActiveSession(
  client: SupabaseClient,
  roomId: string,
): Promise<ApiError | null> {
  const { error } = (await client.rpc("cancel_active_session", {
    p_room_id: roomId,
  })) as RpcResult<{ cancelled_session_id: string | null }>;
  return error ? toApiError(error) : null;
}

// --- lobby read helpers (RLS-scoped; no business logic) ---------------------

const ROOM_COLUMNS =
  "id, code, host_member_id, anchor_label, anchor_lat, anchor_lng, " +
  "filter_open_now, filter_cuisines, filter_price_levels, default_radius_m, " +
  "is_active, created_at, updated_at";

interface RoomRow {
  id: string;
  code: string;
  host_member_id: string | null;
  anchor_label: string | null;
  anchor_lat: number;
  anchor_lng: number;
  filter_open_now: boolean;
  filter_cuisines: string[];
  filter_price_levels: PriceLevel[];
  default_radius_m: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapRoomRow(row: RoomRow): Room {
  return {
    id: row.id,
    code: row.code,
    hostMemberId: row.host_member_id,
    anchorLabel: row.anchor_label,
    anchorLat: row.anchor_lat,
    anchorLng: row.anchor_lng,
    filterOpenNow: row.filter_open_now,
    filterCuisines: row.filter_cuisines,
    filterPriceLevels: row.filter_price_levels,
    defaultRadiusM: row.default_radius_m,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const MEMBER_COLUMNS =
  "id, room_id, user_id, display_name, role, joined_at, left_at";

interface MemberRow {
  id: string;
  room_id: string;
  user_id: string | null;
  display_name: string;
  role: MemberRole;
  joined_at: string;
  left_at: string | null;
}

function mapMemberRow(row: MemberRow): RoomMember {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
  };
}

/** Read a single room the caller belongs to (RLS: rooms_select_member), mapped to `Room`. */
export async function getRoom(
  client: SupabaseClient,
  roomId: string,
): Promise<ClientResult<Room>> {
  const { data, error } = await client
    .from("rooms")
    .select(ROOM_COLUMNS)
    .eq("id", roomId)
    .single()
    .returns<RoomRow>();
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  return { data: mapRoomRow(data), error: null };
}

/**
 * Read a room's ACTIVE members in join order (RLS: room_members_select_same_room scopes this to
 * co-members of rooms the caller belongs to), mapped to `RoomMember[]`. Filters to `left_at is
 * null` so the lobby shows the live roster (Phase 4.7) — a member who left or was auto-removed
 * disappears, and the caller detects their own removal by their absence from this list. Only
 * co-member rows are ever exposed — never another member's swipes (CLAUDE.md §3).
 */
export async function getRoomMembers(
  client: SupabaseClient,
  roomId: string,
): Promise<ClientResult<RoomMember[]>> {
  const { data, error } = await client
    .from("room_members")
    .select(MEMBER_COLUMNS)
    .eq("room_id", roomId)
    .is("left_at", null)
    .order("joined_at")
    .returns<MemberRow[]>();
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  return { data: data.map(mapMemberRow), error: null };
}
