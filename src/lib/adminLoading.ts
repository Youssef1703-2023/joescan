export interface AdminLoadFailure { section: string; code: string }

// Apply each successful response independently: an optional query must never
// discard the users response. Callbacks also run inside the error boundary.
export async function loadAdminSections(tasks: Record<string, () => Promise<void>>): Promise<AdminLoadFailure[]> {
  const entries = Object.entries(tasks);
  const results = await Promise.allSettled(entries.map(([, run]) => Promise.resolve().then(run)));
  return results.flatMap((result, index) => result.status === 'fulfilled' ? [] : [{
    section: entries[index][0],
    code: typeof result.reason?.code === 'string' ? result.reason.code : 'unknown',
  }]);
}
