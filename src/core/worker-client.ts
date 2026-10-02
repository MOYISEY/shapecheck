import { LIMITS, type Batch, type Project } from './types';
type WorkerMessage = Batch | { type: 'ready' };
export type WorkerLike = { postMessage: (data: Project) => void; terminate: () => void; onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null; onerror: ((event: ErrorEvent) => void) | null };
export function startValidation(project: Project, onDone: (batch: Batch) => void, factory: () => WorkerLike = () => new Worker(new URL('../validation.worker.ts', import.meta.url), { type: 'module' }), timeout: number = LIMITS.timeoutMs) {
  const worker = factory(); let ended = false; let started = false;
  const finish = (batch: Batch) => { if (ended) return; ended = true; clearTimeout(timer); worker.terminate(); onDone(batch); };
  let timer = setTimeout(() => finish({ schemaStatus: 'schema', schemaIssue: {code:'workerLoad',path:''},results:[] }),10000);
  worker.onmessage = event => {
    if (ended) return;
    if ('type' in event.data && event.data.type === 'ready') {
      if (started) return; started=true; clearTimeout(timer);
      timer=setTimeout(() => finish({ results: project.fixtures.map(f => ({ id: f.id, status: 'timeout', issues: [{ code: 'timeout', path: '' }] })) }),timeout);
      worker.postMessage(project);return;
    }
    if (started) finish(event.data as Batch);
  };
  worker.onerror = () => finish({ schemaStatus: 'schema', schemaIssue: { code: 'worker', path: '/' }, results: [] });
  return () => { if (ended) return; ended = true; clearTimeout(timer); worker.terminate(); };
}
