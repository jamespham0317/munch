import type {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  SetPresenceRequest,
  SetPresenceResponse,
  UpdateRoomFiltersRequest,
  UpdateRoomFiltersResponse,
} from "@munch/core";
import type { SupabaseClient } from "@supabase/supabase-js";

import { type ClientResult, notImplemented } from "../errors";

/**
 * Room + membership endpoints (docs/04 §3.1–§3.4). Stubs only in Phase 0 — typed
 * against the shared @munch/core request/response schemas so the wire contract is
 * fixed now. TODO(Phase 1/2): implement via Supabase RPCs and map snake_case ↔
 * camelCase at this boundary (docs/06 §5).
 */

export function createRoom(
  _client: SupabaseClient,
  _req: CreateRoomRequest,
): Promise<ClientResult<CreateRoomResponse>> {
  return notImplemented("create_room", "Phase 1");
}

export function joinRoom(
  _client: SupabaseClient,
  _req: JoinRoomRequest,
): Promise<ClientResult<JoinRoomResponse>> {
  return notImplemented("join_room", "Phase 1");
}

export function updateRoomFilters(
  _client: SupabaseClient,
  _req: UpdateRoomFiltersRequest,
): Promise<ClientResult<UpdateRoomFiltersResponse>> {
  return notImplemented("update_room_filters", "Phase 1");
}

export function setPresence(
  _client: SupabaseClient,
  _req: SetPresenceRequest,
): Promise<ClientResult<SetPresenceResponse>> {
  return notImplemented("set_presence", "Phase 2");
}
