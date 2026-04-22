// ============================================================
// Social OSINT Scanner — Types, Platform DB, and Search Wrapper
// Uses gemini.ts's searchSocialProfiles (no separate AI client)
// ============================================================

import { searchSocialProfiles, searchPhoneProfiles } from './gemini';

export interface PlatformHit {
  platform: string;
  url: string;
  status: 'hit' | 'miss';
  responseTime?: number;
  category?: string;
  bio?: string;
  followers?: string;
  verified?: boolean;
  accountType?: string;
  accountName?: string;
  registrationStatus?: 'registered' | 'not_found';
}

export interface SocialOsintResult {
  username: string;
  totalPlatforms: number;
  hits: PlatformHit[];
  status: 'running' | 'completed' | 'error';
  phoneInfo?: PhoneInfo;
}

export interface PhoneInfo {
  carrier?: string;
  country?: string;
  region?: string;
  lineType?: string;
  breachExposure?: string;
  associatedNames?: string[];
}

// ───── Known platform URL patterns (100+ platforms) ─────
const PLATFORM_DB: { name: string; urlPattern: string; category: string }[] = [
  // Social Media
  { name: "Twitter/X", urlPattern: "https://x.com/{}", category: "social" },
  { name: "Instagram", urlPattern: "https://www.instagram.com/{}", category: "social" },
  { name: "TikTok", urlPattern: "https://www.tiktok.com/@{}", category: "social" },
  { name: "Facebook", urlPattern: "https://www.facebook.com/{}", category: "social" },
  { name: "Snapchat", urlPattern: "https://www.snapchat.com/add/{}", category: "social" },
  { name: "Pinterest", urlPattern: "https://www.pinterest.com/{}", category: "social" },
  { name: "Tumblr", urlPattern: "https://{}.tumblr.com", category: "social" },
  { name: "YouTube", urlPattern: "https://www.youtube.com/@{}", category: "social" },
  { name: "VK", urlPattern: "https://vk.com/{}", category: "social" },
  { name: "Mastodon", urlPattern: "https://mastodon.social/@{}", category: "social" },
  { name: "Threads", urlPattern: "https://www.threads.net/@{}", category: "social" },
  { name: "Bluesky", urlPattern: "https://bsky.app/profile/{}.bsky.social", category: "social" },
  { name: "Telegram", urlPattern: "https://t.me/{}", category: "social" },
  { name: "Flickr", urlPattern: "https://www.flickr.com/people/{}", category: "social" },
  { name: "Spotify", urlPattern: "https://open.spotify.com/user/{}", category: "social" },
  { name: "SoundCloud", urlPattern: "https://soundcloud.com/{}", category: "social" },
  { name: "500px", urlPattern: "https://500px.com/p/{}", category: "social" },
  { name: "VSCO", urlPattern: "https://vsco.co/{}/gallery", category: "social" },
  { name: "Vimeo", urlPattern: "https://vimeo.com/{}", category: "social" },
  { name: "DailyMotion", urlPattern: "https://www.dailymotion.com/{}", category: "social" },
  { name: "Imgur", urlPattern: "https://imgur.com/user/{}", category: "social" },
  { name: "Clubhouse", urlPattern: "https://www.clubhouse.com/@{}", category: "social" },
  { name: "Rumble", urlPattern: "https://rumble.com/user/{}", category: "social" },

  // Professional
  { name: "LinkedIn", urlPattern: "https://www.linkedin.com/in/{}", category: "professional" },
  { name: "GitHub", urlPattern: "https://github.com/{}", category: "professional" },
  { name: "GitLab", urlPattern: "https://gitlab.com/{}", category: "professional" },
  { name: "Bitbucket", urlPattern: "https://bitbucket.org/{}", category: "professional" },
  { name: "Medium", urlPattern: "https://medium.com/@{}", category: "professional" },
  { name: "Dev.to", urlPattern: "https://dev.to/{}", category: "professional" },
  { name: "Behance", urlPattern: "https://www.behance.net/{}", category: "professional" },
  { name: "Dribbble", urlPattern: "https://dribbble.com/{}", category: "professional" },
  { name: "HackerRank", urlPattern: "https://www.hackerrank.com/profile/{}", category: "professional" },
  { name: "LeetCode", urlPattern: "https://leetcode.com/u/{}", category: "professional" },
  { name: "Kaggle", urlPattern: "https://www.kaggle.com/{}", category: "professional" },
  { name: "CodePen", urlPattern: "https://codepen.io/{}", category: "professional" },
  { name: "Hashnode", urlPattern: "https://hashnode.com/@{}", category: "professional" },
  { name: "Fiverr", urlPattern: "https://www.fiverr.com/{}", category: "professional" },
  { name: "About.me", urlPattern: "https://about.me/{}", category: "professional" },
  { name: "Gravatar", urlPattern: "https://en.gravatar.com/{}", category: "professional" },
  { name: "ProductHunt", urlPattern: "https://www.producthunt.com/@{}", category: "professional" },
  { name: "NPM", urlPattern: "https://www.npmjs.com/~{}", category: "professional" },
  { name: "Docker Hub", urlPattern: "https://hub.docker.com/u/{}", category: "professional" },
  { name: "Replit", urlPattern: "https://replit.com/@{}", category: "professional" },
  { name: "Slideshare", urlPattern: "https://www.slideshare.net/{}", category: "professional" },
  { name: "Keybase", urlPattern: "https://keybase.io/{}", category: "professional" },
  { name: "Substack", urlPattern: "https://{}.substack.com", category: "professional" },
  { name: "WordPress", urlPattern: "https://{}.wordpress.com", category: "professional" },

  // Gaming
  { name: "Twitch", urlPattern: "https://www.twitch.tv/{}", category: "gaming" },
  { name: "Steam", urlPattern: "https://steamcommunity.com/id/{}", category: "gaming" },
  { name: "Xbox", urlPattern: "https://account.xbox.com/en-us/profile?gamertag={}", category: "gaming" },
  { name: "Epic Games", urlPattern: "https://store.epicgames.com/u/{}", category: "gaming" },
  { name: "Roblox", urlPattern: "https://www.roblox.com/user.aspx?username={}", category: "gaming" },
  { name: "Chess.com", urlPattern: "https://www.chess.com/member/{}", category: "gaming" },
  { name: "Lichess", urlPattern: "https://lichess.org/@/{}", category: "gaming" },
  { name: "Minecraft", urlPattern: "https://namemc.com/profile/{}", category: "gaming" },
  { name: "Kick", urlPattern: "https://kick.com/{}", category: "gaming" },

  // Forums & Communities
  { name: "Reddit", urlPattern: "https://www.reddit.com/user/{}", category: "forums" },
  { name: "Quora", urlPattern: "https://www.quora.com/profile/{}", category: "forums" },
  { name: "Hacker News", urlPattern: "https://news.ycombinator.com/user?id={}", category: "forums" },
  { name: "GoodReads", urlPattern: "https://www.goodreads.com/{}", category: "forums" },
  { name: "Disqus", urlPattern: "https://disqus.com/by/{}", category: "forums" },
  { name: "Wikipedia", urlPattern: "https://en.wikipedia.org/wiki/User:{}", category: "forums" },
  { name: "MyAnimeList", urlPattern: "https://myanimelist.net/profile/{}", category: "forums" },
  { name: "Letterboxd", urlPattern: "https://letterboxd.com/{}", category: "forums" },
  { name: "Last.fm", urlPattern: "https://www.last.fm/user/{}", category: "forums" },
  { name: "Wattpad", urlPattern: "https://www.wattpad.com/user/{}", category: "forums" },
  { name: "9GAG", urlPattern: "https://9gag.com/u/{}", category: "forums" },

  // Other
  { name: "Patreon", urlPattern: "https://www.patreon.com/{}", category: "other" },
  { name: "Linktree", urlPattern: "https://linktr.ee/{}", category: "other" },
  { name: "PayPal.me", urlPattern: "https://paypal.me/{}", category: "other" },
  { name: "Etsy", urlPattern: "https://www.etsy.com/shop/{}", category: "other" },
  { name: "eBay", urlPattern: "https://www.ebay.com/usr/{}", category: "other" },
  { name: "BuyMeACoffee", urlPattern: "https://buymeacoffee.com/{}", category: "other" },
  { name: "Ko-fi", urlPattern: "https://ko-fi.com/{}", category: "other" },
  { name: "OpenSea", urlPattern: "https://opensea.io/{}", category: "other" },
  { name: "Bandcamp", urlPattern: "https://{}.bandcamp.com", category: "other" },
  { name: "Poshmark", urlPattern: "https://poshmark.com/closet/{}", category: "other" },
];

export function categorizePlatform(platformName: string): string {
  const lower = platformName.toLowerCase();
  const match = PLATFORM_DB.find(p => p.name.toLowerCase() === lower);
  if (match) return match.category;

  const SOCIAL_KW = ['twitter', 'x.com', 'instagram', 'tiktok', 'facebook', 'snapchat', 'pinterest', 'tumblr', 'mastodon', 'threads', 'bluesky', 'vk', 'weibo', 'youtube', 'spotify', 'soundcloud'];
  const PROFESSIONAL_KW = ['linkedin', 'github', 'gitlab', 'bitbucket', 'behance', 'dribbble', 'medium', 'dev.to', 'stackoverflow', 'kaggle', 'hackerrank'];
  const GAMING_KW = ['steam', 'xbox', 'playstation', 'epic', 'twitch', 'roblox', 'minecraft', 'chess', 'lichess', 'kick'];
  const FORUM_KW = ['reddit', 'quora', 'discourse', 'hackernews', 'forum', 'community', 'hacker news'];

  if (SOCIAL_KW.some(k => lower.includes(k))) return 'social';
  if (PROFESSIONAL_KW.some(k => lower.includes(k))) return 'professional';
  if (GAMING_KW.some(k => lower.includes(k))) return 'gaming';
  if (FORUM_KW.some(k => lower.includes(k))) return 'forums';
  return 'other';
}

function generateCandidateList(username: string): string {
  return PLATFORM_DB.map(p =>
    `${p.name}: ${p.urlPattern.replace('{}', username)}`
  ).join('\n');
}

// ───── Main search function ─────
export async function searchUsername(
  username: string,
  onProgress?: (status: string, checked: number, total: number) => void,
  _options: { signal?: AbortSignal } = {},
): Promise<SocialOsintResult> {
  const trimmed = username.trim();
  if (!trimmed) throw new Error('INVALID_USERNAME');

  const totalPlatforms = PLATFORM_DB.length;

  // Simulate scanning progress while AI works
  onProgress?.('running', 0, totalPlatforms);
  let progressCount = 0;
  const progressInterval = setInterval(() => {
    progressCount = Math.min(progressCount + Math.floor(Math.random() * 8) + 3, totalPlatforms - 5);
    onProgress?.('running', progressCount, totalPlatforms);
  }, 400);

  try {
    const candidateList = generateCandidateList(trimmed);
    let result: any;

    try {
      result = await searchSocialProfiles(trimmed, candidateList);
    } catch (aiErr: any) {
      clearInterval(progressInterval);
      console.error('[SocialOSINT] AI search failed:', aiErr);
      if (aiErr.message?.includes('429') || aiErr.message?.includes('quota') || aiErr.message?.includes('Resource has been exhausted')) {
        throw new Error('RATE_LIMIT');
      }
      throw new Error(aiErr.message || 'AI search failed. Please try again.');
    }

    clearInterval(progressInterval);

    // Defensively parse the AI response
    let foundProfiles: any[] = [];
    try {
      if (result && typeof result === 'object') {
        foundProfiles = Array.isArray(result.foundProfiles) ? result.foundProfiles : [];
      }
    } catch {
      foundProfiles = [];
    }

    const hits: PlatformHit[] = foundProfiles
      .filter((p: any) => p && typeof p === 'object' && typeof p.url === 'string' && typeof p.platform === 'string' && p.url.length > 0)
      .map((p: any) => ({
        platform: String(p.platform || 'Unknown'),
        url: String(p.url || ''),
        status: 'hit' as const,
        category: categorizePlatform(String(p.platform || '')),
        bio: typeof p.bio === 'string' ? p.bio : undefined,
        followers: typeof p.followers === 'string' ? p.followers : (typeof p.followers === 'number' ? String(p.followers) : undefined),
        verified: Boolean(p.verified),
        accountType: typeof p.accountType === 'string' ? p.accountType : undefined,
      }));

    onProgress?.('completed', totalPlatforms, totalPlatforms);

    return {
      username: trimmed,
      totalPlatforms,
      hits,
      status: 'completed',
    };

  } catch (err: any) {
    clearInterval(progressInterval);
    throw err;
  }
}

// ───── Phone Number OSINT Search ─────
export async function searchPhoneNumber(
  phoneNumber: string,
  onProgress?: (status: string, checked: number, total: number) => void,
): Promise<SocialOsintResult> {
  const trimmed = phoneNumber.trim();
  if (!trimmed) throw new Error('INVALID_PHONE');

  const totalPlatforms = 50; // Approximate platforms checked for phone

  onProgress?.('running', 0, totalPlatforms);
  let progressCount = 0;
  const progressInterval = setInterval(() => {
    progressCount = Math.min(progressCount + Math.floor(Math.random() * 5) + 2, totalPlatforms - 3);
    onProgress?.('running', progressCount, totalPlatforms);
  }, 500);

  try {
    let result: any;
    try {
      result = await searchPhoneProfiles(trimmed);
    } catch (aiErr: any) {
      clearInterval(progressInterval);
      console.error('[PhoneOSINT] AI search failed:', aiErr);
      if (aiErr.message?.includes('429') || aiErr.message?.includes('quota') || aiErr.message?.includes('Resource has been exhausted')) {
        throw new Error('RATE_LIMIT');
      }
      throw new Error(aiErr.message || 'Phone lookup failed. Please try again.');
    }

    clearInterval(progressInterval);

    let foundProfiles: any[] = [];
    try {
      if (result && typeof result === 'object') {
        foundProfiles = Array.isArray(result.foundProfiles) ? result.foundProfiles : [];
      }
    } catch {
      foundProfiles = [];
    }

    // Parse phone info
    let phoneInfo: PhoneInfo | undefined;
    try {
      if (result?.phoneInfo && typeof result.phoneInfo === 'object') {
        phoneInfo = {
          carrier: typeof result.phoneInfo.carrier === 'string' ? result.phoneInfo.carrier : undefined,
          country: typeof result.phoneInfo.country === 'string' ? result.phoneInfo.country : undefined,
          region: typeof result.phoneInfo.region === 'string' ? result.phoneInfo.region : undefined,
          lineType: typeof result.phoneInfo.lineType === 'string' ? result.phoneInfo.lineType : undefined,
          breachExposure: typeof result.phoneInfo.breachExposure === 'string' ? result.phoneInfo.breachExposure : undefined,
          associatedNames: Array.isArray(result.phoneInfo.associatedNames) ? result.phoneInfo.associatedNames : undefined,
        };
      }
    } catch {
      phoneInfo = undefined;
    }

    const allEntries: PlatformHit[] = foundProfiles
      .filter((p: any) => p && typeof p === 'object' && typeof p.platform === 'string')
      .map((p: any) => {
        const isRegistered = typeof p.status === 'string' && p.status.toLowerCase() === 'registered';
        return {
          platform: String(p.platform || 'Unknown'),
          url: String(p.url || ''),
          status: (isRegistered ? 'hit' : 'miss') as 'hit' | 'miss',
          category: categorizePlatform(String(p.platform || '')),
          bio: typeof p.bio === 'string' ? p.bio : undefined,
          accountName: typeof p.accountName === 'string' ? p.accountName : undefined,
          registrationStatus: isRegistered ? 'registered' as const : 'not_found' as const,
        };
      });

    // Separate: registered first, not_found second
    const hits = allEntries.filter(e => e.registrationStatus === 'registered');
    const notFound = allEntries.filter(e => e.registrationStatus === 'not_found');

    onProgress?.('completed', totalPlatforms, totalPlatforms);

    return {
      username: trimmed,
      totalPlatforms,
      hits: [...hits, ...notFound],
      status: 'completed',
      phoneInfo,
    };

  } catch (err: any) {
    clearInterval(progressInterval);
    throw err;
  }
}
