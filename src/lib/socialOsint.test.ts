import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./gemini', () => ({
  searchSocialProfiles: vi.fn(),
  searchPhoneProfiles: vi.fn(),
}));

describe('socialOsint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns categorized hit results from the API flow', async () => {
    const { searchSocialProfiles } = await import('./gemini');
    vi.mocked(searchSocialProfiles).mockResolvedValueOnce({
      foundProfiles: [
        {
          platform: 'Twitter/X',
          url: 'https://x.com/john_doe',
          bio: 'Developer',
          followers: '1.2k',
          verified: true,
          accountType: 'Personal',
        },
        {
          platform: 'GitHub',
          url: 'https://github.com/john_doe',
        },
      ],
    });

    const { searchUsername } = await import('./socialOsint');
    const result = await searchUsername('john_doe');

    expect(searchSocialProfiles).toHaveBeenCalledWith('john_doe', expect.any(String));
    expect(result.username).toBe('john_doe');
    expect(result.status).toBe('completed');
    expect(result.hits).toEqual([
      {
        platform: 'Twitter/X',
        url: 'https://x.com/john_doe',
        status: 'hit',
        category: 'social',
        bio: 'Developer',
        followers: '1.2k',
        verified: true,
        accountType: 'Personal',
      },
      {
        platform: 'GitHub',
        url: 'https://github.com/john_doe',
        status: 'hit',
        category: 'professional',
        bio: undefined,
        followers: undefined,
        verified: false,
        accountType: undefined,
      },
    ]);
  });

  it('rejects invalid usernames before calling the network', async () => {
    const { searchSocialProfiles } = await import('./gemini');
    const { searchUsername } = await import('./socialOsint');

    await expect(searchUsername('   ')).rejects.toThrow('INVALID_USERNAME');
    expect(searchSocialProfiles).not.toHaveBeenCalled();
  });

  it('surfaces rate-limit failures from the provider', async () => {
    const { searchSocialProfiles } = await import('./gemini');
    vi.mocked(searchSocialProfiles).mockRejectedValueOnce(new Error('429 Quota exceeded'));

    const { searchUsername } = await import('./socialOsint');

    await expect(searchUsername('john_doe')).rejects.toThrow('RATE_LIMIT');
  });
});
