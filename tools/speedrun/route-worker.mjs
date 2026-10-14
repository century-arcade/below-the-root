import { parentPort, workerData } from 'node:worker_threads';
import { load } from './game.mjs';
import { segments, chain } from './routes.mjs';
const { file, k, n } = workerData;
const segs = segments(load(file));
const out = [];
segs.forEach((seg, i) => { if (i % n === k) out.push(...chain(seg)); });
parentPort.postMessage(out);
