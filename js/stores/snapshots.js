import { apiList } from '../api-client.js';

let snapshots = [];

export async function loadSnapshots() {
  try {
    snapshots = await apiList('dailySnapshots');
    snapshots.sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    console.warn('Could not load snapshots:', e.message);
    snapshots = [];
  }
  return snapshots;
}

export function getSnapshots() { return snapshots; }

export function getRecentSnapshots(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return snapshots.filter(s => s.date >= cutoffStr);
}
