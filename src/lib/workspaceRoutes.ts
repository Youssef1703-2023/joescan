export type TabId = 'dashboard' | 'history' | 'watchlist' | 'email' | 'password' | 'url' | 'message' | 'domain' | 'pricing' | 'admin' | 'support' | 'api_keys' | 'team' | 'threat_3d' | 'referral' | 'blog';

// URL path <-> TabId mapping
export const TAB_TO_PATH: Record<TabId, string> = {
  dashboard: '/',
  history: '/history',
  watchlist: '/watchlist',
  email: '/email-audit',
  password: '/password-vault',
  url: '/suspicious-link',
  message: '/message-phishing',
  domain: '/domain-whois',
  pricing: '/pricing',
  admin: '/admin',
  support: '/support',
  api_keys: '/api-keys',
  team: '/team',
  threat_3d: '/threat-3d',
  referral: '/referral',
  blog: '/blog',
};

export const PATH_TO_TAB: Record<string, TabId> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, path]) => [path, tab as TabId])
) as Record<string, TabId>;

