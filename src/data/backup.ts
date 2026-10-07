// Backup helpers: validation (zod) + download filename. Pure (no DOM);
// the component owns the <a download> / <input type=file> wiring.
import { backupPayloadSchema, type BackupPayloadValidated } from '../types/schemas';
import type { BackupPayload } from './db';

export interface BackupCheck {
  ok: boolean;
  errors: string[];
  payload?: BackupPayloadValidated;
}

/** Validate an uploaded JSON backup before it touches any store. */
export function validateBackupPayload(raw: unknown): BackupCheck {
  const parsed = backupPayloadSchema.safeParse(raw);
  if (parsed.success) return { ok: true, errors: [], payload: parsed.data };
  const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  return { ok: false, errors };
}

export function backupFileName(now: Date = new Date()): string {
  return `AquaLedger_Backup_${now.toISOString().slice(0, 10)}.json`;
}

export function serializeBackup(b: BackupPayload): string {
  return JSON.stringify(b, null, 2);
}
