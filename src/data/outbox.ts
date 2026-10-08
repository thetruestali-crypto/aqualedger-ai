// Offline AI outbox (FR-12): texts that could not reach /api/analyze-transaction
// wait in the Dexie pendingQueue with a clear "pending" state until retried.
// Browser + tests (via fake-indexeddb); no DOM here.
import { getDb } from './db';

export interface QueuedAIRequest {
  id: string;
  createdAt: string; // ISO
  text: string;
  context?: { bossName?: string; companyName?: string; typicalAmount?: number };
}

export async function enqueueAIRequest(
  text: string,
  context?: QueuedAIRequest['context'],
): Promise<QueuedAIRequest> {
  const row: QueuedAIRequest = {
    id: `q-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    createdAt: new Date().toISOString(),
    text,
    context,
  };
  await getDb().pendingQueue.put({
    id: row.id,
    createdAt: row.createdAt,
    kind: 'text',
    text: row.text,
    context: row.context,
    status: 'pending',
  });
  return row;
}

export async function listAIQueue(): Promise<QueuedAIRequest[]> {
  const rows = await getDb().pendingQueue.orderBy('createdAt').toArray();
  return rows
    .filter((r) => r.kind === 'text' && r.status === 'pending')
    .map((r) => ({ id: r.id, createdAt: r.createdAt, text: r.text ?? '', context: r.context }));
}

export async function removeAIRequest(id: string): Promise<void> {
  await getDb().pendingQueue.delete(id);
}
