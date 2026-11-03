// Dexie (IndexedDB) database for TA/DA Insights
import Dexie, { type Table } from 'dexie';
import type { MonthlyDataset } from '../types';

export class TadaDatabase extends Dexie {
  datasets!: Table<MonthlyDataset, string>;

  constructor() {
    super('tada-insights');
    this.version(1).stores({
      datasets: 'id, month, uploadedAt',
    });
  }
}

export const db = new TadaDatabase();
