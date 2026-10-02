import { parentPort } from 'node:worker_threads';
import { validateBatch } from '../src/core/validate';
import type { Project } from '../src/core/types';
parentPort!.on('message', (project: Project) => parentPort!.postMessage(validateBatch(project)));
