import { MMKV } from 'react-native-mmkv';
import { apiPost } from '../../api';

const store = new MMKV({ id: 'sppero-queue' });
const QUEUE_KEY = 'offline_queue';

interface QueuedRequest {
  id: string;
  url: string;
  body: Record<string, unknown>;
  ts: number;
}

function readQueue(): QueuedRequest[] {
  const raw = store.getString(QUEUE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function writeQueue(q: QueuedRequest[]): void {
  store.set(QUEUE_KEY, JSON.stringify(q));
}

export const OfflineQueue = {
  // Add a POST request to queue when offline
  enqueue(url: string, body: Record<string, unknown>): void {
    const q = readQueue();
    q.push({ id: `${Date.now()}-${Math.random()}`, url, body, ts: Date.now() });
    writeQueue(q);
  },

  // Flush all queued requests — call on reconnect
  async flush(): Promise<void> {
    const q = readQueue();
    if (q.length === 0) return;
    const failed: QueuedRequest[] = [];
    for (const req of q) {
      try {
        const res = await apiPost(req.url, req.body);
        if (res._error) failed.push(req);
      } catch {
        failed.push(req);
      }
    }
    writeQueue(failed);
  },

  count(): number { return readQueue().length; },

  clear(): void { store.delete(QUEUE_KEY); },
};
