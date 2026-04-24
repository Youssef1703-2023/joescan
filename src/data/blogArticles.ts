export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  date: string;
  readTime: string;
  tags: string[];
  featured?: boolean;
  isNews?: boolean;
}

export const ARTICLES: Article[] = [
  {
    id: '1',
    title: 'Top 10 Data Breaches of 2025 — Is Your Data Among Them?',
    summary: '2025 saw an unprecedented wave of data breaches affecting billions of users worldwide.',
    content: `## Top 10 Data Breaches of 2025

The digital world in 2025 witnessed a terrifying escalation in the scale and sophistication of data breaches.

### 1. National Public Data Breach — 2.9 Billion Records
A massive database was leaked containing personal data for millions of people, including Social Security numbers and addresses.

**Key Lesson:** Never trust any company with your data — even government-affiliated ones.

### 2. MOVEit Hack — Full Supply Chain Compromise
Attackers exploited a zero-day vulnerability in the MOVEit file transfer software, affecting thousands of companies.

### 3. ChatGPT Leak — Millions of User Conversations
The conversation histories of millions of ChatGPT users were leaked, including sensitive information.

### 4. AT&T Breach — 73 Million Customers
Data of 73 million customers was leaked, including Social Security numbers.

### 5. Hospital Ransomware Attack — Lives at Risk
Ransomware groups targeted hospitals across multiple countries, putting lives in danger.

---

## How to Protect Yourself

1. **Use a password manager** — Never reuse passwords across sites
2. **Enable Two-Factor Authentication (2FA)** on all your accounts
3. **Monitor your data** continuously using tools like JoeScan
4. **Update your software** immediately when security patches are released`,
    category: 'Data Breaches',
    date: '2025-04-20',
    readTime: '7 min',
    tags: ['Data Breaches', 'Data Protection', '2025'],
    featured: true,
  },
  {
    id: '2',
    title: '"123456" Is Still the Most Common Password — How to Protect Your Accounts',
    summary: 'Despite all warnings, millions of users still use weak passwords.',
    content: `## Why Is "123456" a Real Problem?

According to NordPass's 2025 report, "123456" is still **the most commonly used password worldwide**.

### How to Create a Strong Password

**The ideal method:** Use a **passphrase** instead of a single word:
- ❌ john123
- ✅ I_Love_Coffee_At_7AM!

**Strong Password Rules:**
1. **At least 12 characters**
2. **Uppercase and lowercase letters**
3. **Numbers and symbols** — like @, #, $
4. **Don't use personal information**

### Use a Password Manager
- **Bitwarden** (free and open source)
- **1Password** (paid but excellent)
- **KeePass** (free and works offline)

### Two-Factor Authentication: Your Last Line of Defense
- **Authenticator App** (Best) — Google Authenticator or Authy
- **SMS** (Acceptable)
- **Physical Security Key** (Strongest) — YubiKey`,
    category: 'Passwords',
    date: '2025-04-18',
    readTime: '5 min',
    tags: ['Passwords', 'Account Security'],
  },
  {
    id: '3',
    title: 'Phishing Attacks in 2025 — New and Dangerous Techniques',
    summary: 'Scammers are getting smarter! Learn about the latest phishing techniques targeting users worldwide.',
    content: `## Phishing Attacks: A New Wave

In 2025, we saw a **300% increase** in sophisticated phishing messages across all languages.

### Most Common Phishing Types:

#### 1. Fake Bank Messages 🏦
"Dear customer, your account has been frozen." — Banks NEVER ask for your credentials via email.

#### 2. Fake Job Offers 💼
"Congratulations! You've been hired at $10,000/month." — Real jobs don't require upfront fees.

#### 3. Prize Scams You Never Entered 🎁
"You won an iPhone 16 Pro!" — Nobody gives away free gifts.

#### 4. Fake Shipping Notifications 📦
"Your package is on its way! Pay customs fees." — Contact the shipping company directly.

### What to Do If You Receive a Suspicious Message
1. **Don't click any links**
2. **Don't reply to the message**
3. **Scan the link** using JoeScan's URL scanner
4. **Report the message**`,
    category: 'Phishing',
    date: '2025-04-15',
    readTime: '6 min',
    tags: ['Phishing', 'Social Engineering'],
  },
  {
    id: '4',
    title: 'Café & Hotel WiFi — Why It\'s Dangerous and How to Stay Safe',
    summary: 'Public WiFi networks are a hacker\'s paradise. Learn how to browse safely.',
    content: `## Public WiFi: The Hidden Danger

Every time you connect to WiFi in a café or hotel, you're **exposing your data to risk**.

### How They Steal Your Data

#### 1. Man-in-the-Middle Attack 👤
The hacker positions themselves between you and the router, reading all your data.

#### 2. Evil Twin Attack 👥
Creates a WiFi network with the same name as the café's network. You connect thinking it's real.

#### 3. Packet Sniffing 📡
Anyone on the same network can capture your unencrypted data.

### How to Protect Yourself
- ✅ **Always use a VPN** — ProtonVPN is free and secure
- ✅ **Check for HTTPS** — Look for 🔒 in the address bar
- ✅ **Disable auto-connect** on open networks
- ✅ **Use 4G/5G** for sensitive transactions`,
    category: 'Networks',
    date: '2025-04-10',
    readTime: '8 min',
    tags: ['WiFi', 'VPN', 'Public Networks'],
  },
  {
    id: '5',
    title: 'Your Digital Footprint — The Internet Knows More Than You Think',
    summary: 'Every click, every search, every photo — the Internet remembers everything.',
    content: `## Your Digital Footprint: What Does the Internet Know About You?

Every time you use the Internet, you leave a **digital footprint** containing more information than you imagine:

- 📍 **Your location** — accurate to a few meters
- 🖥️ **Your device** — type, OS, screen resolution
- 🌐 **Your browser** — installed extensions, language, fonts
- 🕐 **Your habits** — when you connect, what you search, what you buy

### How to Reduce Your Digital Footprint

1. **Review privacy settings** on all your accounts
2. **Delete old accounts** — use justdelete.me
3. **Use DuckDuckGo** instead of Google
4. **Use ProtonMail** instead of Gmail
5. **Scan your data** regularly using JoeScan`,
    category: 'Privacy',
    date: '2025-04-05',
    readTime: '9 min',
    tags: ['Privacy', 'Digital Footprint'],
  },
  {
    id: '6',
    title: '🔴 BREAKING: Massive TikTok Breach Exposes 500 Million Accounts',
    summary: 'Half a billion TikTok user records leaked including phone numbers and emails. Check if you\'re affected.',
    content: `## TikTok Breach: What Happened?

In April 2025, a hacking group announced they had obtained a database containing data of **500 million TikTok users**.

### What Was Leaked?
- 📧 Email addresses
- 📱 Phone numbers
- 👤 Usernames and real names
- 📍 Geolocation data
- 🔐 Authentication tokens

### Is Your Account Affected?
Use JoeScan's **Email Audit** tool to check if your email was part of the breach.

### What to Do Now
1. **Change your TikTok password immediately**
2. **Enable two-factor authentication**
3. **Review linked apps** on your account
4. **Change passwords** on any site where you used the same credentials`,
    category: 'Breaking News',
    date: '2025-04-22',
    readTime: '3 min',
    tags: ['TikTok', 'Data Breach', 'Breaking'],
    isNews: true,
  },
  {
    id: '7',
    title: '🔴 WARNING: New Banking SMS Scam Wave Hits Users Worldwide',
    summary: 'Fake SMS messages impersonating major banks. Thousands of victims in a single week.',
    content: `## SMS Banking Scam Wave

In the past week, thousands of users received fake SMS messages claiming to be from their banks.

### Typical Scam Message:
"Dear customer, your card has been suspended for security reasons. Please update your details immediately via the following link..."

### How to Spot Fake Messages
- 🔴 **Strange URL** — Official banks never send shortened links
- 🔴 **Urgent language** — They try to scare you into acting fast
- 🔴 **Grammar errors** — Official bank messages are error-free
- 🔴 **Sender number** — Not from the bank's official numbers

### What to Do
1. **Never click the link**
2. **Call your bank** from their official number directly
3. **Report the message** to authorities
4. **Scan the link** using JoeScan's URL scanner`,
    category: 'Breaking News',
    date: '2025-04-21',
    readTime: '4 min',
    tags: ['Scam', 'Banking', 'SMS'],
    isNews: true,
  },
  {
    id: '8',
    title: 'AI in the Hands of Hackers — New Threats of 2025',
    summary: 'Hackers are using AI to craft perfect phishing emails, clone voices, and create deepfakes. Here\'s how to protect yourself.',
    content: `## AI: The Hacker's New Weapon

In 2025, artificial intelligence became **the most dangerous tool** in the hacker's arsenal.

### How They Use AI

#### 1. Perfect Phishing Emails 📧
AI writes flawless messages — in any language and personalized for any target.

#### 2. Voice Deepfake 🎤
They clone your boss's or relative's voice and request money transfers.

#### 3. Deepfake Video 🎥
They produce realistic-looking videos of people saying things they never said.

#### 4. CAPTCHA Breaking 🤖
AI solves "I am not a robot" tests with 100% accuracy.

#### 5. Password Cracking ⚡
AI guesses passwords 1000x faster than traditional methods.

### How to Protect Yourself
- **Verify caller identity** — even if the voice sounds familiar
- **Don't trust videos blindly** — verify the source
- **Use long passwords** (16+ characters)
- **Enable hardware key authentication** (YubiKey)`,
    category: 'Reports',
    date: '2025-04-19',
    readTime: '6 min',
    tags: ['AI', 'Deepfake', 'Threats'],
  },
  {
    id: '9',
    title: 'Ransomware — How to Protect Your Files from Being Held Hostage',
    summary: 'Ransomware attacks have quadrupled. Your complete guide to protection.',
    content: `## Ransomware: The Digital Nightmare

Ransomware locks your files and demands cryptocurrency payment to decrypt them.

### How Do You Get Infected?
- 📧 **Infected email attachments** — Malicious Word or PDF files
- 🌐 **Compromised websites** — Automatic downloads without your knowledge
- 💾 **Infected USB drives** — From untrusted sources
- 📱 **Fake apps** — From outside official app stores

### How to Protect Yourself

#### 1. Backup Strategy 💾
- **3-2-1 Rule:** 3 copies, on 2 different media, 1 offsite
- Use encrypted cloud storage

#### 2. Keep Software Updated 🔄
- Update Windows and apps immediately
- Never ignore update notifications

#### 3. Be Careful with Attachments 📎
- Don't open attachments from unknown sources
- Scan files with antivirus first

### What to Do If You're Infected
1. **Disconnect from the Internet immediately**
2. **Don't pay the ransom** — there's no guarantee of file recovery
3. **Report to authorities**
4. **Restore from backup**`,
    category: 'Reports',
    date: '2025-04-13',
    readTime: '7 min',
    tags: ['Ransomware', 'Malware', 'Protection'],
  },
  {
    id: '10',
    title: 'Children\'s Online Safety — A Complete Parent\'s Guide',
    summary: 'Your children are at risk! Learn how to protect them from harmful content, scammers, and cyberbullying.',
    content: `## Protecting Children in the Digital World

Children are among the most vulnerable groups online.

### Main Risks:

#### 1. Inappropriate Content 🚫
- Websites and content unsuitable for their age

#### 2. Cyberbullying 😢
- Abusive comments and harassment on social media

#### 3. Online Predators 🚨
- People impersonating fake identities to contact children

#### 4. Digital Addiction ⏰
- Excessive screen time

### Practical Tips for Parents:

1. **Use parental controls** — Google Family Link or Qustodio
2. **Set screen time limits** — based on child's age
3. **Talk to your children** — teach them not to share personal info
4. **Monitor their friends list** — know who they're talking to
5. **Place devices in shared areas** — not in a closed room
6. **Teach them** to tell you immediately if they feel uncomfortable`,
    category: 'Tips',
    date: '2025-04-08',
    readTime: '5 min',
    tags: ['Children Safety', 'Parental Controls', 'Protection'],
  },
  {
    id: '11',
    title: 'Is Your Phone Hacked? 10 Warning Signs to Watch For',
    summary: 'Your phone could be compromised without you knowing! Discover the signs and how to remove malware.',
    content: `## Is Your Phone Hacked?

### 10 Warning Signs:

1. **🔋 Battery drains abnormally fast** — Spyware consumes power
2. **🌡️ Phone heats up without use** — Background processing
3. **📊 High data consumption** — Your data being sent to the attacker
4. **📱 Unknown apps appeared** — You didn't install them
5. **🔊 Strange sounds during calls** — Potential wiretapping
6. **📩 Strange messages** — Codes or links you didn't request
7. **🐌 Phone is extremely slow** — Without clear reason
8. **📸 Camera or mic activates on its own** — Surveillance
9. **🔄 Automatic restarts** — Malicious updates
10. **💰 High bills** — Calls or messages you didn't make

### How to Remove the Hack
1. **Update your OS** — Usually patches vulnerabilities
2. **Delete suspicious apps**
3. **Change all passwords** from another device
4. **Enable two-factor authentication**
5. **Last resort:** Perform a Factory Reset`,
    category: 'Tips',
    date: '2025-04-03',
    readTime: '5 min',
    tags: ['Mobile', 'Hacking', 'Spyware'],
  },
  {
    id: '12',
    title: '🔴 ALERT: Critical WhatsApp Vulnerability Allows Spying on Messages',
    summary: 'Meta issues emergency update to patch a vulnerability that lets hackers access your conversations. Update now!',
    content: `## New WhatsApp Vulnerability

Meta announced the discovery of a critical security vulnerability **CVE-2025-30401** in WhatsApp.

### What Does the Vulnerability Allow?
- 📖 **Reading encrypted conversations**
- 📸 **Accessing photos and videos**
- 🎤 **Recording calls**
- 📍 **Location tracking**

### Who Is Affected?
- WhatsApp for Android version older than 2.25.8.72
- WhatsApp for iOS version older than 25.8.84

### What to Do
1. **Update WhatsApp immediately** — from Google Play or App Store
2. **Check linked devices** — Settings → Linked Devices
3. **Enable app lock** with fingerprint
4. **Enable two-step verification** — Settings → Account → Two-step verification`,
    category: 'Breaking News',
    date: '2025-04-17',
    readTime: '3 min',
    tags: ['WhatsApp', 'Vulnerability', 'Breaking'],
    isNews: true,
  },
  {
    id: '13',
    title: 'Cryptocurrency Scams — How to Protect Your Wallet',
    summary: 'Billions of dollars lost to crypto scams. Learn to tell real projects from fraud.',
    content: `## Cryptocurrency Fraud: The Dark Side

In 2025, investors lost **more than $5 billion** to cryptocurrency scams.

### Most Common Scam Types:

#### 1. Rug Pull 🏃
A project collects investor funds then suddenly disappears.

#### 2. Pump and Dump 📈📉
They inflate a coin's price then sell, leaving you with losses.

#### 3. Guaranteed Returns 💰
"Get 10% daily!" — There's no such thing as guaranteed returns.

#### 4. Fake Exchange Sites 🌐
Websites that look like Binance or Coinbase but are fake.

### How to Protect Yourself
- ❌ **Don't invest more than you can afford to lose**
- 🔍 **Research the team** — Are they real people?
- 📋 **Read the Whitepaper** — Does the project make sense?
- 🔐 **Use a hardware wallet** (Ledger/Trezor)
- ⚠️ **Beware of unrealistic promises**`,
    category: 'Tips',
    date: '2025-03-28',
    readTime: '6 min',
    tags: ['Cryptocurrency', 'Scams', 'Crypto'],
  },
  {
    id: '14',
    title: 'SIM Swap Attacks — How They Steal Your Phone Number',
    summary: 'SIM Swap attacks let hackers take control of your number and breach all your accounts.',
    content: `## SIM Swap: The Most Dangerous Mobile Attack

The hacker convinces your carrier to transfer your number to a new SIM card. This gives them all your messages and verification codes.

### How the Attack Works
1. The hacker gathers info about you (name, address, ID number)
2. Calls your carrier and impersonates you
3. Requests number transfer to a new SIM
4. Receives all your messages and verification codes
5. Accesses your bank accounts and email

### Who Is at Risk?
- Anyone relying on **SMS for two-factor authentication**
- **Cryptocurrency holders**
- **Public figures** and influencers

### How to Protect Yourself
1. **Set a PIN on your carrier account**
2. **Use Authenticator App** instead of SMS
3. **Don't share personal info** on social media
4. **Enable notifications** on your bank accounts`,
    category: 'Reports',
    date: '2025-03-25',
    readTime: '5 min',
    tags: ['SIM Swap', 'Mobile', 'Hacking'],
  },
  {
    id: '15',
    title: '🔴 URGENT: Google Warns of Critical Chrome Vulnerability — Update Now!',
    summary: 'A zero-day vulnerability in Chrome is actively being exploited. 3 billion users at risk.',
    content: `## New Chrome Vulnerability

Google has released an emergency update for Chrome to patch vulnerability **CVE-2025-2783** which is currently being actively exploited.

### How Serious Is It?
- 💀 **Severity: Critical**
- 🌐 Affects **all operating systems**
- 🎯 **Currently being exploited** in real-world attacks
- 🔓 Allows execution of malicious code on your device

### How to Update Chrome
1. Open Chrome
2. Click **⋮** (three dots) at the top right
3. **Help → About Google Chrome**
4. Chrome will update automatically
5. **Restart the browser**

### Secure Alternatives
- **Brave** — Built on Chromium with extra protection
- **Firefox** — Completely different engine
- **Tor Browser** — Maximum privacy`,
    category: 'Breaking News',
    date: '2025-04-23',
    readTime: '2 min',
    tags: ['Chrome', 'Vulnerability', 'Breaking', 'Google'],
    isNews: true,
  },
];

export const CATEGORIES = ['All', 'Breaking News', 'Data Breaches', 'Reports', 'Passwords', 'Phishing', 'Networks', 'Privacy', 'Tips'];
