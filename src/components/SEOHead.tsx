import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
}

const BASE_TITLE = 'JoeScan';
const BASE_URL = 'https://joescan.me';

const PAGE_META: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Command Center — AI Security Dashboard',
    description: 'Monitor your global security posture, recent scans, risk distribution, and threat intelligence from your AI-powered command center.',
  },
  '/email-audit': {
    title: 'Email Breach Scanner',
    description: 'Check if your email has been compromised in data breaches. Get a comprehensive security audit with remediation steps.',
  },
  '/password-vault': {
    title: 'Password Strength Analyzer',
    description: 'Analyze password entropy, detect dictionary matches, and check for dark web exposure — all offline, zero network.',
  },
  '/phone-number': {
    title: 'Phone Number Intelligence',
    description: 'Validate phone numbers, identify carriers, detect VoIP/prepaid lines, and assess fraud risk with AI-powered analysis.',
  },
  '/osint-username': {
    title: 'OSINT Username Scanner',
    description: 'Search 200+ platforms for a username. Discover linked accounts, social footprint, and digital exposure across the web.',
  },
  '/suspicious-link': {
    title: 'Suspicious URL Scanner',
    description: 'Analyze any URL for phishing indicators, malware, redirect chains, and reputation scoring with AI-powered link forensics.',
  },
  '/message-phishing': {
    title: 'Message Phishing Detector',
    description: 'Paste any SMS or email and let AI detect phishing attempts, social engineering, and scam indicators in real-time.',
  },
  '/ip-scan': {
    title: 'IP Intelligence Scanner',
    description: 'Scan any IP for geolocation, ISP info, VPN/Tor detection, open ports, and threat intelligence from multiple sources.',
  },
  '/domain-whois': {
    title: 'Domain WHOIS & DNS Lookup',
    description: 'Full WHOIS registration data, DNS records, server geolocation, and exportable PDF reports for any domain.',
  },
  '/browser-fingerprint': {
    title: 'Browser Fingerprint Analyzer',
    description: 'Discover how unique your browser fingerprint is. See Canvas, WebGL, Audio fingerprints and tracking exposure score.',
  },
  '/device-security': {
    title: 'Device Security Scanner',
    description: 'Scan your device for open ports, CVE vulnerabilities, and network exposure via Shodan InternetDB integration.',
  },
  '/pricing': {
    title: 'Pricing Plans',
    description: 'Choose the right cybersecurity plan: Free, Pro, or Enterprise. Unlock advanced OSINT tools and unlimited scans.',
  },
  '/blog': {
    title: 'Cybersecurity Blog & News',
    description: 'Latest cybersecurity news, threat intelligence updates, and expert analysis from the JoeScan research team.',
  },
  '/academy': {
    title: 'Cyber Academy',
    description: 'Learn ethical hacking, OSINT techniques, and cybersecurity fundamentals with interactive courses and challenges.',
  },
  '/history': {
    title: 'Scan History',
    description: 'Review your past scans, filter by type, and track your security posture over time.',
  },
  '/threat-map': {
    title: 'Live Threat Map',
    description: 'Real-time global cyber threat visualization with attack origins, target mapping, and trend analysis.',
  },
};

export default function SEOHead({ title, description, path = '/' }: SEOProps) {
  const meta = PAGE_META[path] || PAGE_META['/']!;
  const pageTitle = title || meta.title;
  const pageDesc = description || meta.description;
  const fullTitle = `${pageTitle} | ${BASE_TITLE}`;
  const url = `${BASE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={pageDesc} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={pageDesc} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={pageDesc} />
    </Helmet>
  );
}
