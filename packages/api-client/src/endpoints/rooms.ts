import type {
  CreateRoomRequest,
  JoinRoomRequest,
  MemberRole,
  PriceLevel,
  Room,
  RoomMember,
  SetPresenceRequest,
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
 * through the security-definer RPCs from 0005 (create_room / join_room / update_room_filters);
 * presence, member self-leave, and end-room are direct RLS-scoped table writes permitted by
 * the 0003 policies (room_members_update_own, rooms_update_host) — no RPC needed.
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
  members: Pick<RoomMember, "id" | "displayName" | "role" | "isPresent">[];
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

export interface SetPresenceResult {
  member: Pick<RoomMember, "id" | "isPresent">;
}

export interface LeaveRoomResult {
  member: Pick<RoomMember, "id" | "isPresent" | "leftAt">;
  /** True when the caller was host: leaving soft-closes the room (resolved host-leave policy). */
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
    is_present: boolean;
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
        isPresent: m.is_present,
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

// --- direct RLS-scoped table writes (no RPC) --------------------------------

/**
 * set_presence (docs/04 §3.4): mark the caller present/away. Updates the caller's own
 * room_members row — RLS (room_members_update_own) scopes the write to `user_id = auth.uid()`,
 * and `room_id` selects which membership when the caller is in more than one room.
 */
export async function setPresence(
  client: SupabaseClient,
  roomId: string,
  req: SetPresenceRequest,
): Promise<ClientResult<SetPresenceResult>> {
  const { data, error } = await client
    .from("room_members")
    .update({ is_present: req.is_present })
    .eq("room_id", roomId)
    .select("id, is_present")
    .single()
    .returns<{ id: string; is_present: boolean }>();
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  return {
    data: { member: { id: data.id, isPresent: data.is_present } },
    error: null,
  };
}

/**
 * leave_room (docs/04 §3.10): member self-leave — set is_present=false, left_at=now() on the
 * caller's own row. If the caller is the host, the room ends: soft-close it (is_active=false),
 * the same outcome as endRoom. This is the resolved host-leave policy (was CLAUDE.md §9); host
 * role is NOT transferred. Phase 2 will additionally cancel any in-flight session — there are
 * none to cancel in Phase 1.
 */
export async function leaveRoom(
  client: SupabaseClient,
  roomId: string,
): Promise<ClientResult<LeaveRoomResult>> {
  const { data, error } = await client
    .from("room_members")
    .update({ is_present: false, left_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .select("id, is_present, left_at, role")
    .single()
    .returns<{
      id: string;
      is_present: boolean;
      left_at: string | null;
      role: MemberRole;
    }>();
  if (error) {
    return { data: null, error: toApiError(error) };
  }

  let roomEnded = false;
  if (data.role === "host") {
    const { error: closeError } = await client
      .from("rooms")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", roomId);
    if (closeError) {
      return { data: null, error: toApiError(closeError) };
    }
    roomEnded = true;
  }

  return {
    data: {
      member: { id: data.id, isPresent: data.is_present, leftAt: data.left_at },
      roomEnded,
    },
    error: null,
  };
}

/** end_room (docs/04 §3.10, host): soft-close the room. RLS (rooms_update_host) gates this. */
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
  return {
    data: { room: { id: data.id, isActive: data.is_active } },
    error: null,
  };
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
  "id, room_id, user_id, display_name, role, is_present, joined_at, left_at";

interface MemberRow {
  id: string;
  room_id: string;
  user_id: string | null;
  display_name: string;
  role: MemberRole;
  is_present: boolean;
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
    isPresent: row.is_present,
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
 * Read a room's members in join order (RLS: room_members_select_same_room scopes this to
 * co-members of rooms the caller belongs to), mapped to `RoomMember[]`. Only co-member rows
 * are ever exposed — never another member's swipes (none exist in Phase 1).
 */
export async function getRoomMembers(
  client: SupabaseClient,
  roomId: string,
): Promise<ClientResult<RoomMember[]>> {
  const { data, error } = await client
    .from("room_members")
    .select(MEMBER_COLUMNS)
    .eq("room_id", roomId)
    .order("joined_at")
    .returns<MemberRow[]>();
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  return { data: data.map(mapMemberRow), error: null };
}
