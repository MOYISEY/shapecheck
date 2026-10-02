import { LIMITS, type Batch, type Project } from './types';
export type WorkerLike = { postMessage: (data: Project) => void; terminate: () => void; onmessage: ((event: MessageEvent<Batch>) => void) | null; onerror: ((event: ErrorEvent) => void) | null };
export function startValidation(project: Project, onDone: (batch: Batch) => void, factory: () => WorkerLike = () => new Worker(new URL('../validation.worker.ts', import.meta.url), { type: 'module' }), timeout: number = LIMITS.timeoutMs) {
  const worker = factory(); let ended = false;
  const finish = (batch: Batch) => { if (ended) return; ended = true; clearTimeout(timer); worker.terminate(); onDone(batch); };
  const timer = setTimeout(() => finish({ results: project.fixtures.map(f => ({ id: f.id, status: 'timeout', issues: [{ code: 'timeout', path: '/' }] })) }), timeout);
  worker.onmessage = event => finish(event.data as Batch);
  worker.onerror = () => finish({ schemaStatus: 'schema', schemaIssue: { code: 'worker', path: '/' }, results: [] });
  worker.postMessage(project);
  return () => { if (ended) return; ended = true; clearTimeout(timer); worker.terminate(); };
}
