// Local-database ownership: which IndexedDB / snapshot belongs to whom.
// Guest (offline, no session) keeps using the legacy 'aqualedger' database
// unchanged, so existing offline data never moves. Every logged-in Supabase
// user gets an isolated database `aqualedger_u_<sanitized-id>` — demo seed
// rows can therefore never leak into a real user's balance.
// No DOM, no Dexie, no network: safe to import from stores and unit tests.
export function sanitizeOwnerId(id: string): string {
  const clean = id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return clean || 'user';
}

export function dbNameForOwner(ownerId: string | null | undefined): string {
  if (!ownerId) return 'aqualedger';
  return `aqualedger_u_${sanitizeOwnerId(ownerId)}`;
}

/** True for a real logged-in user id (anything non-empty). */
export function isUserOwner(ownerId: string | null | undefined): boolean {
  return !!ownerId;
}

let currentOwner: string | null = null;

/** Active local-db owner. Switch with bootStore(owner)/switchOwner, never per-op. */
export function setDbOwner(ownerId: string | null | undefined): void {
  currentOwner = ownerId || null;
}

export function getDbOwner(): string | null {
  return currentOwner;
}
