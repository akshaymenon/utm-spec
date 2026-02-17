import { nanoid } from "nanoid";
import type { DraftPayload } from "./core/types";

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredDraft {
  payload: DraftPayload;
  createdAt: number;
}

const store = new Map<string, StoredDraft>();

export function saveDraft(payload: DraftPayload): string {
  const id = nanoid();
  store.set(id, {
    payload,
    createdAt: Date.now(),
  });
  return id;
}

export function loadDraft(draftId: string): DraftPayload | null {
  const entry = store.get(draftId);
  if (!entry) return null;

  if (Date.now() - entry.createdAt > DRAFT_TTL_MS) {
    store.delete(draftId);
    return null;
  }

  return entry.payload;
}

export function clearDraft(draftId: string): void {
  store.delete(draftId);
}
