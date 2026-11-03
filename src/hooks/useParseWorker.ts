// useParseWorker hook for TA/DA Insights
import { useRef, useState, useCallback } from 'react';
import type { MonthlyDataset, WorkerMessage } from '../types';

export interface ParseProgress {
  message: string;
  percent: number;
}

export interface ParseWorkerState {
  parsing: boolean;
  progress: ParseProgress | null;
  error: string | null;
}

export type ParseCallback = (datasets: MonthlyDataset[]) => void;

export function useParseWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<ParseWorkerState>({
    parsing: false,
    progress: null,
    error: null,
  });

  const parse = useCallback((file: File, onResult: ParseCallback) => {
    // Terminate existing worker
    workerRef.current?.terminate();

    setState({ parsing: true, progress: { message: 'Initializing…', percent: 0 }, error: null });

    const worker = new Worker(
      new URL('../workers/parseWorker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'PROGRESS':
          setState(s => ({ ...s, progress: { message: msg.message, percent: msg.percent } }));
          break;
        case 'RESULT':
          setState({ parsing: false, progress: null, error: null });
          worker.terminate();
          onResult(msg.datasets);
          break;
        case 'ERROR':
          setState({ parsing: false, progress: null, error: msg.message });
          worker.terminate();
          break;
      }
    };

    worker.onerror = (err) => {
      setState({ parsing: false, progress: null, error: err.message });
      worker.terminate();
    };

    file.arrayBuffer().then(buffer => {
      worker.postMessage({ type: 'PARSE', buffer, fileName: file.name }, [buffer]);
    });
  }, []);

  const abort = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState({ parsing: false, progress: null, error: null });
  }, []);

  return { ...state, parse, abort };
}
