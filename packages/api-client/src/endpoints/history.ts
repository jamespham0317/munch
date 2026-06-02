import type { MatchHistory } from "@munch/core";
import type { SupabaseClient } from "@supabase/supabase-js";

import { type ClientResult, toApiError } from "../errors";

/**
 * Match-history read (docs/04 §3.9, docs/03 §3.9). A direct RLS-scoped table read — the
 * `match_history_select_own` policy (0003) scopes it to the caller's OWN rows, so no
 * privileged RPC is needed (cf. getRoomMembers' RLS read in rooms.ts). Only signed-in users
 * ever have rows (CLAUDE.md §3 guest ephemerality); a guest's read simply returns `[]` under
 * RLS rather than erroring, so the history screen keys the "sign in to save" state off the
 * profiles/auth state, not off this call. Results map snake_case → camelCase here, the
 * api-client boundary (docs/06 §5).
 */

const MATCH_HISTORY_COLUMNS =
  "id, user_id, match_id, restaurant_name, restaurant_photo_url, " +
  "participant_names, decided_at, created_at";

/**
 * Raw `match_history` row (snake_case; docs/03 §3.9). The wire read contract is
 * `matchHistoryEntrySchema` in @munch/core, which omits `user_id`; we additionally select it
 * because the camelCase `MatchHistory` output carries `userId`.
 */
interface RawMatchHistoryRow {
  id: string;
  user_id: string;
  match_id: string;
  restaurant_name: string;
  restaurant_photo_url: string | null;
  participant_names: string[];
  decided_at: string;
  created_at: string;
}

function mapMatchHistoryRow(row: RawMatchHistoryRow): MatchHistory {
  return {
    id: row.id,
    userId: row.user_id,
    matchId: row.match_id,
    restaurantName: row.restaurant_name,
    restaurantPhotoUrl: row.restaurant_photo_url,
    participantNames: row.participant_names,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

/**
 * getMatchHistory (docs/04 §3.9): read the caller's own match-history rows, most recent first.
 * RLS (match_history_select_own, 0003) returns only `user_id = auth.uid()` rows, so a guest
 * (no rows) gets `[]` and no error. On failure, map via toApiError — an RLS denial surfaces as
 * FORBIDDEN, anything else as the safe default; raw DB text never reaches the UI (docs/06 §8/§9).
 */
export async function getMatchHistory(
  client: SupabaseClient,
): Promise<ClientResult<MatchHistory[]>> {
  const { data, error } = await client
    .from("match_history")
    .select(MATCH_HISTORY_COLUMNS)
    .order("decided_at", { ascending: false })
    .returns<RawMatchHistoryRow[]>();
  if (error) {
    return { data: null, error: toApiError(error) };
  }
  return { data: (data ?? []).map(mapMatchHistoryRow), error: null };
}
