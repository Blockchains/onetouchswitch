// Stage 2 queue: BullMQ + Redis. Files are written to a private dir; jobs carry only the path.
import { Queue } from "bullmq";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export function createBillQueue({ redisUrl, privateDir }) {
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const connection = { url: redisUrl };
  const q = new Queue("bills", { connection });
  return {
    queue: q,
    async enqueue(buf, meta) { const id = randomUUID(); const path = join(privateDir, `${id}`); writeFileSync(path, buf, { mode: 0o600 }); await q.add("ocr", { path, ...meta }, { jobId: id, attempts: 2, removeOnComplete: { age: 86400 }, removeOnFail: { age: 86400 } }); return id; },
    async status(id) { const j = await q.getJob(id); if (!j) return null; const state = await j.getState(); return { id, state, result: j.returnvalue ?? null, error: j.failedReason ?? null }; },
  };
}
