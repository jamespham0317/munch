/**
 * An optional account profile. A Munch member is a guest vs. an account based on the
 * PRESENCE OF THIS ROW, not on user_id — guests already carry an anonymous auth.users id
 * (docs/01 §10, CLAUDE.md §3). Mirrors the `profiles` table (docs/03-database-schema.md §3.1),
 * mapped to camelCase at the api-client boundary.
 */
export interface Profile {
  /** Same id as the auth.users row (anonymous uid, converted in place on upgrade). */
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}
