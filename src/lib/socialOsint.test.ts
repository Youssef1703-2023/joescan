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

    expect(searchSocialProfiles).toHaveBeenCalledWith(
      'john_doe',
      expect.any(String),
      { signal: expect.any(AbortSignal) },
    );
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

  it('rejects over-length usernames (>64 chars) and short phone numbers (<7 digits) before any AI call', async () => {
    const { searchSocialProfiles, searchPhoneProfiles } = await import('./gemini');
    const { searchUsername, searchPhoneNumber } = await import('./socialOsint');

    await expect(searchUsername('a'.repeat(65))).rejects.toThrow('INVALID_USERNAME');
    expect(searchSocialProfiles).not.toHaveBeenCalled();

    await expect(searchPhoneNumber('+1 (234) 56')).rejects.toThrow('INVALID_PHONE');
    expect(searchPhoneProfiles).not.toHaveBeenCalled();

    await expect(searchPhoneNumber('1'.repeat(25))).rejects.toThrow('INVALID_PHONE');
    expect(searchPhoneProfiles).not.toHaveBeenCalled();
  });

  it('rejects usernames with characters outside the documented set before any AI call', async () => {
    const { searchSocialProfiles } = await import('./gemini');
    const { searchUsername } = await import('./socialOsint');

    await expect(searchUsername('bad user')).rejects.toThrow('INVALID_USERNAME');
    await expect(searchUsername('user!name')).rejects.toThrow('INVALID_USERNAME');
    await expect(searchUsername('user@name')).rejects.toThrow('INVALID_USERNAME');
    expect(searchSocialProfiles).not.toHaveBeenCalled();
  });

  it('accepts a username at the 64-character boundary', async () => {
    const { searchSocialProfiles } = await import('./gemini');
    vi.mocked(searchSocialProfiles).mockResolvedValueOnce({ foundProfiles: [] });

    const { searchUsername } = await import('./socialOsint');
    const username = 'a'.repeat(64);
    const result = await searchUsername(username);

    expect(searchSocialProfiles).toHaveBeenCalledWith(
      username,
      expect.any(String),
      { signal: expect.any(AbortSignal) },
    );
    expect(result.username).toBe(username);
    expect(result.status).toBe('completed');
    expect(result.hits).toEqual([]);
  });

  it('surfaces rate-limit failures from the provider', async () => {
    const { searchSocialProfiles } = await import('./gemini');
    vi.mocked(searchSocialProfiles).mockRejectedValueOnce(new Error('429 Quota exceeded'));

    const { searchUsername } = await import('./socialOsint');

    await expect(searchUsername('john_doe')).rejects.toThrow('RATE_LIMIT');
  });

  it('rejects with TIMEOUT when the AI call exceeds timeoutMs', async () => {
    const { searchSocialProfiles } = await import('./gemini');
    vi.mocked(searchSocialProfiles).mockImplementationOnce(() => new Promise(() => {}));

    const { searchUsername } = await import('./socialOsint');

    await expect(searchUsername('john_doe', undefined, { timeoutMs: 20 })).rejects.toThrow('TIMEOUT');
  });

  it('rejects with AbortError (not RATE_LIMIT or TIMEOUT) when the caller signal aborts', async () => {
    const { searchSocialProfiles } = await import('./gemini');
    vi.mocked(searchSocialProfiles).mockImplementationOnce(() => new Promise(() => {}));

    const { searchUsername } = await import('./socialOsint');
    const controller = new AbortController();
    const pending = searchUsername('john_doe', undefined, {
      signal: controller.signal,
      timeoutMs: 5000,
    });

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(pending).rejects.not.toThrow('RATE_LIMIT');
    await expect(pending).rejects.not.toThrow('TIMEOUT');
  });
});
