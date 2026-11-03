// Dexie hooks for TA/DA Insights
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { MonthlyDataset } from '../types';

export function useDatasets(): MonthlyDataset[] | undefined {
  return useLiveQuery(() => db.datasets.orderBy('month').toArray());
}

export function useDataset(month: string): MonthlyDataset | undefined {
  return useLiveQuery(() => db.datasets.get(month), [month]);
}

export async function deleteDataset(month: string): Promise<void> {
  await db.datasets.delete(month);
}

export async function saveDataset(dataset: MonthlyDataset): Promise<void> {
  await db.datasets.put(dataset);
}
