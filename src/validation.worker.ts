import { validateBatch } from './core/validate';
import type { Project } from './core/types';
self.onmessage = (event: MessageEvent<Project>) => { self.postMessage(validateBatch(event.data)); };
self.postMessage({ type: 'ready' });
