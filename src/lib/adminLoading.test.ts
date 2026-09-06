import { describe, it, expect, vi } from 'vitest';
import { loadAdminSections } from './adminLoading';
describe('admin data loading', () => {
  it('keeps users available when an optional query is denied', async () => {
    const applyUsers = vi.fn();
    const failures = await loadAdminSections({users: async () => { applyUsers([{ id: 'registered-user' }]); }, promos: async () => { throw { code: 'permission-denied' }; }});
    expect(applyUsers).toHaveBeenCalledWith([{ id: 'registered-user' }]);
    expect(failures).toEqual([{ section: 'promos', code: 'permission-denied' }]);
  });
  it('reports users read failure rather than treating it as an empty result', async () => {
    expect(await loadAdminSections({ users: async () => { throw { code: 'unavailable' }; } })).toEqual([{ section: 'users', code: 'unavailable' }]);
  });
  it('clears errors on successful retry, including genuinely empty results', async () => {
    const run = vi.fn().mockRejectedValueOnce({code:'unavailable'}).mockResolvedValueOnce(undefined);
    expect(await loadAdminSections({users:run})).toHaveLength(1);
    expect(await loadAdminSections({users:run})).toEqual([]);
  });
});
