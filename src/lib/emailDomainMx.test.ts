import { describe, expect, it, vi } from 'vitest';
import { checkEmailDomainMx } from './emailDomainMx';

function dnsFetch(body: unknown) {
  return vi.fn(async () => ({ json: async () => body }));
}

describe('checkEmailDomainMx', () => {
  it('returns has_mx when Google DNS answers Status 0 with MX records', async () => {
    const fetchImpl = dnsFetch({ Status: 0, Answer: [{ data: '1 mail.example.com.' }] });
    await expect(checkEmailDomainMx('example.com', fetchImpl)).resolves.toBe('has_mx');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://dns.google/resolve?name=example.com&type=MX',
    );
  });

  it('returns no_mx when Google DNS answers a non-zero Status', async () => {
    const fetchImpl = dnsFetch({ Status: 3 });
    await expect(checkEmailDomainMx('heloo.com', fetchImpl)).resolves.toBe('no_mx');
  });

  it('returns no_mx when Google DNS answers Status 0 with no Answer array', async () => {
    const fetchImpl = dnsFetch({ Status: 0 });
    await expect(checkEmailDomainMx('heloo.com', fetchImpl)).resolves.toBe('no_mx');
  });

  it('returns no_mx when Google DNS answers Status 0 with an empty Answer array', async () => {
    const fetchImpl = dnsFetch({ Status: 0, Answer: [] });
    await expect(checkEmailDomainMx('heloo.com', fetchImpl)).resolves.toBe('no_mx');
  });

  it('returns unknown when the DNS fetch throws (caller falls back to scanning)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(checkEmailDomainMx('example.com', fetchImpl)).resolves.toBe('unknown');
  });

  it('encodes the domain into the DNS query string', async () => {
    const fetchImpl = dnsFetch({ Status: 0, Answer: [{ data: '1 mail.example.com.' }] });
    await checkEmailDomainMx('exa&mple.com', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://dns.google/resolve?name=exa%26mple.com&type=MX',
    );
  });
});
