import { z } from "zod";

import {
  displayNameSchema,
  joinCodeSchema,
  latSchema,
  lngSchema,
  radiusMSchema,
} from "./common";
import { memberRoleSchema } from "./enums";
import { roomFiltersSchema } from "./filters";

/**
 * Request/response schemas for the room + membership endpoints in
 * docs/04-api-specification.md §3.1–§3.4. Wire shapes are snake_case.
 */

// 3.1 create_room
export const createRoomRequestSchema = z.object({
  host_display_name: displayNameSchema,
  anchor_lat: latSchema,
  anchor_lng: lngSchema,
  filters: roomFiltersSchema,
  default_radius_m: radiusMSchema,
});
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;

export const createRoomResponseSchema = z.object({
  room: z.object({ id: z.uuid(), code: joinCodeSchema }),
  member: z.object({
    id: z.uuid(),
    role: memberRoleSchema,
    display_name: z.string(),
  }),
});
export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>;

// 3.2 join_room
export const joinRoomRequestSchema = z.object({
  code: joinCodeSchema,
  display_name: displayNameSchema,
});
export type JoinRoomRequest = z.infer<typeof joinRoomRequestSchema>;

export const joinRoomResponseSchema = z.object({
  room: z.object({
    id: z.uuid(),
    code: joinCodeSchema,
  }),
  member: z.object({
    id: z.uuid(),
    role: memberRoleSchema,
    display_name: z.string(),
  }),
  members: z.array(
    z.object({
      id: z.uuid(),
      display_name: z.string(),
      role: memberRoleSchema,
    }),
  ),
});
export type JoinRoomResponse = z.infer<typeof joinRoomResponseSchema>;

// 3.3 update_room_filters (host only) — all fields optional; only provided fields change.
export const updateRoomFiltersRequestSchema = z.object({
  anchor_lat: latSchema.optional(),
  anchor_lng: lngSchema.optional(),
  filters: roomFiltersSchema.partial().optional(),
  default_radius_m: radiusMSchema.optional(),
});
export type UpdateRoomFiltersRequest = z.infer<
  typeof updateRoomFiltersRequestSchema
>;

// The response echoes the updated room; the doc leaves the exact shape open, so we
// echo the editable fields (docs/04 §3.3).
export const updateRoomFiltersResponseSchema = z.object({
  room: z.object({
    id: z.uuid(),
    anchor_lat: latSchema,
    anchor_lng: lngSchema,
    filters: roomFiltersSchema,
    default_radius_m: radiusMSchema,
  }),
});
export type UpdateRoomFiltersResponse = z.infer<
  typeof updateRoomFiltersResponseSchema
>;

// 3.4 presence is no longer a server write — cosmetic Here/Away rides Supabase
// Realtime Presence (ephemeral, zero DB), so there is no set_presence request/
// response schema (roadmap §6.7, docs/04 §3.4).

// 3.10 leave_room — acts on the caller's own membership; no mutable body. The
// target room is identified by the api-client's roomId argument (path-style) +
// RLS (docs/04 §3.10).
export const leaveRoomRequestSchema = z.object({});
export type LeaveRoomRequest = z.infer<typeof leaveRoomRequestSchema>;

export const leaveRoomResponseSchema = z.object({
  member: z.object({
    id: z.uuid(),
    left_at: z.string().nullable(), // set once the caller has left
  }),
  // True when the caller was host: leaving soft-closes the room (resolved
  // host-leave policy, was CLAUDE.md §9). Host role is not transferred.
  room_ended: z.boolean(),
});
export type LeaveRoomResponse = z.infer<typeof leaveRoomResponseSchema>;

// 3.10 end_room (host) — no mutable body; returns the soft-closed room.
export const endRoomRequestSchema = z.object({});
export type EndRoomRequest = z.infer<typeof endRoomRequestSchema>;

export const endRoomResponseSchema = z.object({
  room: z.object({ id: z.uuid(), is_active: z.boolean() }), // is_active=false
});
export type EndRoomResponse = z.infer<typeof endRoomResponseSchema>;
