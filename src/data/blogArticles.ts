export interface Article {
  id: string;
  title: string;
  titleAr: string;
  summary: string;
  summaryAr: string;
  content: string;
  contentAr: string;
  category: string;
  categoryAr: string;
  date: string;
  readTime: string;
  readTimeAr: string;
  tags: string[];
  tagsAr: string[];
  featured?: boolean;
  isNews?: boolean;
}

export const ARTICLES: Article[] = [
  {
    id: '1',
    title: 'Top 10 Data Breaches of 2025 — Is Your Data Among Them?',
    titleAr: 'أخطر 10 اختراقات بيانات في 2025 — هل بياناتك من بينها؟',
    summary: '2025 saw an unprecedented wave of data breaches affecting billions of users worldwide.',
    summaryAr: 'شهد عام 2025 موجة غير مسبوقة من اختراقات البيانات أثّرت على مليارات المستخدمين حول العالم.',
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
    contentAr: `## أخطر 10 اختراقات بيانات في 2025

شهد العالم الرقمي في 2025 تصعيداً مرعباً في حجم وتعقيد اختراقات البيانات.

### 1. اختراق البيانات العامة الوطنية — 2.9 مليار سجل
تسرّبت قاعدة بيانات ضخمة تحتوي على بيانات شخصية لملايين الأشخاص، بما في ذلك أرقام الضمان الاجتماعي والعناوين.

**الدرس المستفاد:** لا تثق بأي شركة ببياناتك — حتى المرتبطة بالحكومة.

### 2. اختراق MOVEit — اختراق سلسلة التوريد الكاملة
استغل المهاجمون ثغرة يوم صفر في برنامج نقل الملفات MOVEit، مما أثّر على آلاف الشركات.

### 3. تسريب ChatGPT — ملايين محادثات المستخدمين
تسرّبت سجلات محادثات ملايين مستخدمي ChatGPT، بما في ذلك معلومات حساسة.

### 4. اختراق AT&T — 73 مليون عميل
تسرّبت بيانات 73 مليون عميل، بما في ذلك أرقام الضمان الاجتماعي.

### 5. هجوم فدية على المستشفيات — أرواح في خطر
استهدفت مجموعات الفدية مستشفيات عبر دول متعددة، مما وضع أرواحاً في خطر.

---

## كيف تحمي نفسك

1. **استخدم مدير كلمات مرور** — لا تُعد استخدام كلمات المرور عبر المواقع
2. **فعّل المصادقة الثنائية (2FA)** على جميع حساباتك
3. **راقب بياناتك** باستمرار باستخدام أدوات مثل JoeScan
4. **حدّث برامجك** فوراً عند صدور تحديثات أمنية`,
    category: 'Data Breaches',
    categoryAr: 'اختراقات البيانات',
    date: '2025-04-20',
    readTime: '7 min',
    readTimeAr: '٧ دقائق',
    tags: ['Data Breaches', 'Data Protection', '2025'],
    tagsAr: ['اختراقات البيانات', 'حماية البيانات', '٢٠٢٥'],
    featured: true,
  },
  {
    id: '2',
    title: '"123456" Is Still the Most Common Password — How to Protect Your Accounts',
    titleAr: '"123456" لا تزال أكثر كلمة مرور شيوعاً — كيف تحمي حساباتك',
    summary: 'Despite all warnings, millions of users still use weak passwords.',
    summaryAr: 'رغم كل التحذيرات، لا يزال ملايين المستخدمين يستخدمون كلمات مرور ضعيفة.',
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
    contentAr: `## لماذا "123456" مشكلة حقيقية؟

حسب تقرير NordPass لعام 2025، لا تزال "123456" **أكثر كلمة مرور استخداماً في العالم**.

### كيف تُنشئ كلمة مرور قوية

**الطريقة المثالية:** استخدم **عبارة مرور** بدلاً من كلمة واحدة:
- ❌ john123
- ✅ أ_حب_القهوة_الساعة_7_صباحاً!

**قواعد كلمة المرور القوية:**
1. **12 حرفاً على الأقل**
2. **أحرف كبيرة وصغيرة**
3. **أرقام ورموز** — مثل @, #, $
4. **لا تستخدم معلومات شخصية**

### استخدم مدير كلمات مرور
- **Bitwarden** (مجاني ومفتوح المصدر)
- **1Password** (مدفوع لكن ممتاز)
- **KeePass** (مجاني ويعمل بدون إنترنت)

### المصادقة الثنائية: خط دفاعك الأخير
- **تطبيق مصادقة** (الأفضل) — Google Authenticator أو Authy
- **رسالة نصية** (مقبول)
- **مفتاح أمان مادي** (الأقوى) — YubiKey`,
    category: 'Passwords',
    categoryAr: 'كلمات المرور',
    date: '2025-04-18',
    readTime: '5 min',
    readTimeAr: '٥ دقائق',
    tags: ['Passwords', 'Account Security'],
    tagsAr: ['كلمات المرور', 'أمان الحسابات'],
  },
  {
    id: '3',
    title: 'Phishing Attacks in 2025 — New and Dangerous Techniques',
    titleAr: 'هجمات التصيّد في 2025 — تقنيات جديدة وخطيرة',
    summary: 'Scammers are getting smarter! Learn about the latest phishing techniques targeting users worldwide.',
    summaryAr: 'المحتالون يزدادون ذكاءً! تعرّف على أحدث تقنيات التصيّد التي تستهدف المستخدمين حول العالم.',
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
    contentAr: `## هجمات التصيّد: موجة جديدة

في 2025، شهدنا **زيادة بنسبة 300%** في رسائل التصيّد المتطورة بجميع اللغات.

### أكثر أنواع التصيّد شيوعاً:

#### 1. رسائل بنكية مزيّفة 🏦
"عزيزي العميل، تم تجميد حسابك." — البنوك لا تطلب بياناتك عبر البريد الإلكتروني أبداً.

#### 2. عروض عمل وهمية 💼
"مبروك! تم تعيينك براتب 10,000$/شهرياً." — الوظائف الحقيقية لا تطلب رسوم مقدّمة.

#### 3. جوائز لم تشارك فيها 🎁
"ربحت iPhone 16 Pro!" — لا أحد يوزّع هدايا مجانية.

#### 4. إشعارات شحن مزيّفة 📦
"طردك في الطريق! ادفع رسوم الجمارك." — تواصل مع شركة الشحن مباشرة.

### ماذا تفعل إذا وصلتك رسالة مشبوهة
1. **لا تضغط على أي رابط**
2. **لا تردّ على الرسالة**
3. **افحص الرابط** باستخدام فاحص الروابط في JoeScan
4. **بلّغ عن الرسالة**`,
    category: 'Phishing',
    categoryAr: 'التصيّد الاحتيالي',
    date: '2025-04-15',
    readTime: '6 min',
    readTimeAr: '٦ دقائق',
    tags: ['Phishing', 'Social Engineering'],
    tagsAr: ['التصيّد', 'الهندسة الاجتماعية'],
  },
  {
    id: '4',
    title: 'Café & Hotel WiFi — Why It\'s Dangerous and How to Stay Safe',
    titleAr: 'واي فاي المقاهي والفنادق — لماذا خطير وكيف تبقى آمناً',
    summary: 'Public WiFi networks are a hacker\'s paradise. Learn how to browse safely.',
    summaryAr: 'شبكات الواي فاي العامة جنّة القراصنة. تعلّم كيف تتصفح بأمان.',
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
    contentAr: `## واي فاي عام: الخطر الخفي

كل مرة تتصل بواي فاي في مقهى أو فندق، أنت **تعرّض بياناتك للخطر**.

### كيف يسرقون بياناتك

#### 1. هجوم الرجل في الوسط 👤
يضع القرصان نفسه بينك وبين الراوتر، ويقرأ كل بياناتك.

#### 2. هجوم التوأم الشرير 👥
ينشئ شبكة واي فاي بنفس اسم شبكة المقهى. تتصل بها ظناً منك أنها الحقيقية.

#### 3. التقاط الحزم 📡
أي شخص على نفس الشبكة يمكنه التقاط بياناتك غير المشفّرة.

### كيف تحمي نفسك
- ✅ **استخدم VPN دائماً** — ProtonVPN مجاني وآمن
- ✅ **تأكد من HTTPS** — ابحث عن 🔒 في شريط العنوان
- ✅ **أوقف الاتصال التلقائي** بالشبكات المفتوحة
- ✅ **استخدم 4G/5G** للمعاملات الحساسة`,
    category: 'Networks',
    categoryAr: 'الشبكات',
    date: '2025-04-10',
    readTime: '8 min',
    readTimeAr: '٨ دقائق',
    tags: ['WiFi', 'VPN', 'Public Networks'],
    tagsAr: ['واي فاي', 'VPN', 'شبكات عامة'],
  },
  {
    id: '5',
    title: 'Your Digital Footprint — The Internet Knows More Than You Think',
    titleAr: 'بصمتك الرقمية — الإنترنت يعرف أكثر مما تتخيّل',
    summary: 'Every click, every search, every photo — the Internet remembers everything.',
    summaryAr: 'كل نقرة، كل بحث، كل صورة — الإنترنت يتذكر كل شيء.',
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
    contentAr: `## بصمتك الرقمية: ماذا يعرف الإنترنت عنك؟

كل مرة تستخدم الإنترنت، تترك **بصمة رقمية** تحتوي على معلومات أكثر مما تتخيّل:

- 📍 **موقعك** — دقيق لبضعة أمتار
- 🖥️ **جهازك** — النوع، نظام التشغيل، دقة الشاشة
- 🌐 **متصفحك** — الإضافات المُثبتة، اللغة، الخطوط
- 🕐 **عاداتك** — متى تتصل، ماذا تبحث، ماذا تشتري

### كيف تُقلّل بصمتك الرقمية

1. **راجع إعدادات الخصوصية** في كل حساباتك
2. **احذف الحسابات القديمة** — استخدم justdelete.me
3. **استخدم DuckDuckGo** بدلاً من Google
4. **استخدم ProtonMail** بدلاً من Gmail
5. **افحص بياناتك** بانتظام باستخدام JoeScan`,
    category: 'Privacy',
    categoryAr: 'الخصوصية',
    date: '2025-04-05',
    readTime: '9 min',
    readTimeAr: '٩ دقائق',
    tags: ['Privacy', 'Digital Footprint'],
    tagsAr: ['الخصوصية', 'البصمة الرقمية'],
  },
  {
    id: '6',
    title: '🔴 BREAKING: Massive TikTok Breach Exposes 500 Million Accounts',
    titleAr: '🔴 عاجل: اختراق ضخم لـ TikTok يكشف 500 مليون حساب',
    summary: 'Half a billion TikTok user records leaked including phone numbers and emails. Check if you\'re affected.',
    summaryAr: 'تسريب سجلات نصف مليار مستخدم TikTok بما في ذلك أرقام الهواتف والبريد الإلكتروني. تحقق إن كنت متأثراً.',
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
    contentAr: `## اختراق TikTok: ماذا حدث؟

في أبريل 2025، أعلنت مجموعة قرصنة أنها حصلت على قاعدة بيانات تحتوي بيانات **500 مليون مستخدم TikTok**.

### ماذا تسرّب؟
- 📧 عناوين البريد الإلكتروني
- 📱 أرقام الهواتف
- 👤 أسماء المستخدمين والأسماء الحقيقية
- 📍 بيانات الموقع الجغرافي
- 🔐 رموز المصادقة

### هل حسابك متأثر؟
استخدم أداة **فحص البريد** في JoeScan للتحقق إن كان بريدك جزءاً من الاختراق.

### ماذا تفعل الآن
1. **غيّر كلمة مرور TikTok فوراً**
2. **فعّل المصادقة الثنائية**
3. **راجع التطبيقات المرتبطة** بحسابك
4. **غيّر كلمات المرور** على أي موقع استخدمت فيه نفس الكلمة`,
    category: 'Breaking News',
    categoryAr: 'أخبار عاجلة',
    date: '2025-04-22',
    readTime: '3 min',
    readTimeAr: '٣ دقائق',
    tags: ['TikTok', 'Data Breach', 'Breaking'],
    tagsAr: ['تيك توك', 'اختراق بيانات', 'عاجل'],
    isNews: true,
  },
  {
    id: '7',
    title: '🔴 WARNING: New Banking SMS Scam Wave Hits Users Worldwide',
    titleAr: '🔴 تحذير: موجة جديدة من رسائل البنوك الاحتيالية تضرب المستخدمين',
    summary: 'Fake SMS messages impersonating major banks. Thousands of victims in a single week.',
    summaryAr: 'رسائل نصية مزيّفة تنتحل صفة بنوك كبرى. آلاف الضحايا في أسبوع واحد.',
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
    contentAr: `## موجة احتيال بنكي عبر الرسائل النصية

خلال الأسبوع الماضي، تلقّى آلاف المستخدمين رسائل نصية مزيّفة تدّعي أنها من بنوكهم.

### رسالة احتيال نموذجية:
"عزيزي العميل، تم تعليق بطاقتك لأسباب أمنية. يرجى تحديث بياناتك فوراً عبر الرابط التالي..."

### كيف تكشف الرسائل المزيّفة
- 🔴 **رابط غريب** — البنوك الرسمية لا ترسل روابط مختصرة
- 🔴 **لغة عاجلة** — يحاولون تخويفك للتصرف بسرعة
- 🔴 **أخطاء لغوية** — رسائل البنوك الرسمية خالية من الأخطاء
- 🔴 **رقم المُرسل** — ليس من أرقام البنك الرسمية

### ماذا تفعل
1. **لا تضغط على الرابط أبداً**
2. **اتصل ببنكك** من رقمهم الرسمي مباشرة
3. **بلّغ عن الرسالة** للجهات المختصة
4. **افحص الرابط** باستخدام فاحص الروابط في JoeScan`,
    category: 'Breaking News',
    categoryAr: 'أخبار عاجلة',
    date: '2025-04-21',
    readTime: '4 min',
    readTimeAr: '٤ دقائق',
    tags: ['Scam', 'Banking', 'SMS'],
    tagsAr: ['احتيال', 'بنوك', 'رسائل نصية'],
    isNews: true,
  },
  {
    id: '8',
    title: 'AI in the Hands of Hackers — New Threats of 2025',
    titleAr: 'الذكاء الاصطناعي في أيدي القراصنة — تهديدات 2025 الجديدة',
    summary: 'Hackers are using AI to craft perfect phishing emails, clone voices, and create deepfakes. Here\'s how to protect yourself.',
    summaryAr: 'القراصنة يستخدمون الذكاء الاصطناعي لصياغة رسائل تصيّد مثالية واستنساخ الأصوات وإنشاء التزييف العميق.',
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
    contentAr: `## الذكاء الاصطناعي: سلاح القراصنة الجديد

في 2025، أصبح الذكاء الاصطناعي **أخطر أداة** في ترسانة القراصنة.

### كيف يستخدمون الذكاء الاصطناعي

#### 1. رسائل تصيّد مثالية 📧
الذكاء الاصطناعي يكتب رسائل خالية من الأخطاء — بأي لغة ومخصّصة لأي هدف.

#### 2. التزييف الصوتي العميق 🎤
يستنسخون صوت مديرك أو قريبك ويطلبون تحويلات مالية.

#### 3. فيديو التزييف العميق 🎥
ينتجون فيديوهات واقعية لأشخاص يقولون أشياء لم يقولوها أبداً.

#### 4. كسر CAPTCHA 🤖
الذكاء الاصطناعي يحل اختبارات "أنا لست روبوت" بدقة 100%.

#### 5. كسر كلمات المرور ⚡
الذكاء الاصطناعي يخمّن كلمات المرور أسرع 1000 مرة من الطرق التقليدية.

### كيف تحمي نفسك
- **تحقق من هوية المتصل** — حتى لو كان الصوت مألوفاً
- **لا تثق بالفيديوهات بشكل أعمى** — تحقق من المصدر
- **استخدم كلمات مرور طويلة** (16+ حرفاً)
- **فعّل مصادقة المفتاح المادي** (YubiKey)`,
    category: 'Reports',
    categoryAr: 'تقارير',
    date: '2025-04-19',
    readTime: '6 min',
    readTimeAr: '٦ دقائق',
    tags: ['AI', 'Deepfake', 'Threats'],
    tagsAr: ['ذكاء اصطناعي', 'تزييف عميق', 'تهديدات'],
  },
  {
    id: '9',
    title: 'Ransomware — How to Protect Your Files from Being Held Hostage',
    titleAr: 'فيروسات الفدية — كيف تحمي ملفاتك من الاحتجاز',
    summary: 'Ransomware attacks have quadrupled. Your complete guide to protection.',
    summaryAr: 'هجمات الفدية تضاعفت أربع مرات. دليلك الكامل للحماية.',
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
    contentAr: `## فيروسات الفدية: الكابوس الرقمي

فيروسات الفدية تقفل ملفاتك وتطالب بالدفع بالعملات الرقمية لفك تشفيرها.

### كيف تُصاب؟
- 📧 **مرفقات بريد مصابة** — ملفات Word أو PDF خبيثة
- 🌐 **مواقع مُخترقة** — تنزيلات تلقائية بدون علمك
- 💾 **أقراص USB مصابة** — من مصادر غير موثوقة
- 📱 **تطبيقات مزيّفة** — من خارج متاجر التطبيقات الرسمية

### كيف تحمي نفسك

#### 1. استراتيجية النسخ الاحتياطي 💾
- **قاعدة 3-2-1:** 3 نسخ، على وسيطين مختلفين، واحدة خارج الموقع
- استخدم تخزين سحابي مشفّر

#### 2. حافظ على تحديث البرامج 🔄
- حدّث Windows والتطبيقات فوراً
- لا تتجاهل إشعارات التحديث

#### 3. كن حذراً مع المرفقات 📎
- لا تفتح مرفقات من مصادر مجهولة
- افحص الملفات ببرنامج مضاد الفيروسات أولاً

### ماذا تفعل إذا أُصبت
1. **افصل الإنترنت فوراً**
2. **لا تدفع الفدية** — ليس هناك ضمان لاستعادة الملفات
3. **بلّغ الجهات المختصة**
4. **استعد من النسخة الاحتياطية**`,
    category: 'Reports',
    categoryAr: 'تقارير',
    date: '2025-04-13',
    readTime: '7 min',
    readTimeAr: '٧ دقائق',
    tags: ['Ransomware', 'Malware', 'Protection'],
    tagsAr: ['فيروسات فدية', 'برمجيات خبيثة', 'حماية'],
  },
  {
    id: '10',
    title: 'Children\'s Online Safety — A Complete Parent\'s Guide',
    titleAr: 'سلامة الأطفال على الإنترنت — دليل كامل للآباء',
    summary: 'Your children are at risk! Learn how to protect them from harmful content, scammers, and cyberbullying.',
    summaryAr: 'أطفالك في خطر! تعلّم كيف تحميهم من المحتوى الضار والمحتالين والتنمّر الإلكتروني.',
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
    contentAr: `## حماية الأطفال في العالم الرقمي

الأطفال من أكثر الفئات المعرّضة للخطر على الإنترنت.

### المخاطر الرئيسية:

#### 1. محتوى غير ملائم 🚫
- مواقع ومحتوى غير مناسب لأعمارهم

#### 2. التنمّر الإلكتروني 😢
- تعليقات مسيئة ومضايقات على وسائل التواصل

#### 3. المتحرّشون عبر الإنترنت 🚨
- أشخاص ينتحلون هويات مزيّفة للتواصل مع الأطفال

#### 4. الإدمان الرقمي ⏰
- وقت شاشة مفرط

### نصائح عملية للآباء:

1. **استخدم أدوات الرقابة الأبوية** — Google Family Link أو Qustodio
2. **حدّد وقت الشاشة** — بناءً على عمر الطفل
3. **تحدّث مع أطفالك** — علّمهم عدم مشاركة معلومات شخصية
4. **راقب قائمة أصدقائهم** — اعرف مع من يتحدثون
5. **ضع الأجهزة في مناطق مشتركة** — ليس في غرفة مغلقة
6. **علّمهم** أن يخبروك فوراً إذا شعروا بعدم ارتياح`,
    category: 'Tips',
    categoryAr: 'نصائح',
    date: '2025-04-08',
    readTime: '5 min',
    readTimeAr: '٥ دقائق',
    tags: ['Children Safety', 'Parental Controls', 'Protection'],
    tagsAr: ['سلامة الأطفال', 'رقابة أبوية', 'حماية'],
  },
  {
    id: '11',
    title: 'Is Your Phone Hacked? 10 Warning Signs to Watch For',
    titleAr: 'هل هاتفك مُخترق؟ 10 علامات تحذيرية انتبه لها',
    summary: 'Your phone could be compromised without you knowing! Discover the signs and how to remove malware.',
    summaryAr: 'هاتفك قد يكون مُخترقاً بدون علمك! اكتشف العلامات وكيفية إزالة البرمجيات الخبيثة.',
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
    contentAr: `## هل هاتفك مُخترق؟

### 10 علامات تحذيرية:

1. **🔋 البطارية تنفد بسرعة غير طبيعية** — برامج التجسس تستهلك الطاقة
2. **🌡️ الهاتف يسخن بدون استخدام** — معالجة في الخلفية
3. **📊 استهلاك بيانات عالي** — بياناتك تُرسل للمهاجم
4. **📱 ظهور تطبيقات مجهولة** — لم تقم بتثبيتها
5. **🔊 أصوات غريبة أثناء المكالمات** — احتمال تنصّت
6. **📩 رسائل غريبة** — أكواد أو روابط لم تطلبها
7. **🐌 الهاتف بطيء للغاية** — بدون سبب واضح
8. **📸 الكاميرا أو المايك يعملان وحدهما** — مراقبة
9. **🔄 إعادة تشغيل تلقائية** — تحديثات خبيثة
10. **💰 فواتير عالية** — مكالمات أو رسائل لم تقم بها

### كيف تُزيل الاختراق
1. **حدّث نظام التشغيل** — عادةً يُصلح الثغرات
2. **احذف التطبيقات المشبوهة**
3. **غيّر كل كلمات المرور** من جهاز آخر
4. **فعّل المصادقة الثنائية**
5. **كحل أخير:** قم بإعادة ضبط المصنع`,
    category: 'Tips',
    categoryAr: 'نصائح',
    date: '2025-04-03',
    readTime: '5 min',
    readTimeAr: '٥ دقائق',
    tags: ['Mobile', 'Hacking', 'Spyware'],
    tagsAr: ['هاتف', 'اختراق', 'تجسس'],
  },
  {
    id: '12',
    title: '🔴 ALERT: Critical WhatsApp Vulnerability Allows Spying on Messages',
    titleAr: '🔴 تنبيه: ثغرة خطيرة في واتساب تسمح بالتجسس على الرسائل',
    summary: 'Meta issues emergency update to patch a vulnerability that lets hackers access your conversations. Update now!',
    summaryAr: 'أصدرت Meta تحديثاً طارئاً لإصلاح ثغرة تتيح للقراصنة الوصول لمحادثاتك. حدّث الآن!',
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
    contentAr: `## ثغرة واتساب الجديدة

أعلنت Meta عن اكتشاف ثغرة أمنية خطيرة **CVE-2025-30401** في واتساب.

### ماذا تسمح الثغرة؟
- 📖 **قراءة المحادثات المشفّرة**
- 📸 **الوصول للصور والفيديوهات**
- 🎤 **تسجيل المكالمات**
- 📍 **تتبع الموقع**

### من المتأثر؟
- واتساب للأندرويد إصدار أقدم من 2.25.8.72
- واتساب لـ iOS إصدار أقدم من 25.8.84

### ماذا تفعل
1. **حدّث واتساب فوراً** — من Google Play أو App Store
2. **تحقق من الأجهزة المرتبطة** — الإعدادات ← الأجهزة المرتبطة
3. **فعّل قفل التطبيق** ببصمة الإصبع
4. **فعّل التحقق بخطوتين** — الإعدادات ← الحساب ← التحقق بخطوتين`,
    category: 'Breaking News',
    categoryAr: 'أخبار عاجلة',
    date: '2025-04-17',
    readTime: '3 min',
    readTimeAr: '٣ دقائق',
    tags: ['WhatsApp', 'Vulnerability', 'Breaking'],
    tagsAr: ['واتساب', 'ثغرة', 'عاجل'],
    isNews: true,
  },
  {
    id: '13',
    title: 'Cryptocurrency Scams — How to Protect Your Wallet',
    titleAr: 'احتيال العملات الرقمية — كيف تحمي محفظتك',
    summary: 'Billions of dollars lost to crypto scams. Learn to tell real projects from fraud.',
    summaryAr: 'مليارات الدولارات خسرها المستخدمون بسبب احتيال العملات الرقمية. تعلّم التمييز بين المشاريع الحقيقية والاحتيال.',
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
    contentAr: `## احتيال العملات الرقمية: الجانب المظلم

في 2025، خسر المستثمرون **أكثر من 5 مليار دولار** بسبب عمليات احتيال العملات الرقمية.

### أكثر أنواع الاحتيال شيوعاً:

#### 1. سحب البساط 🏃
مشروع يجمع أموال المستثمرين ثم يختفي فجأة.

#### 2. التضخيم والتفريغ 📈📉
يرفعون سعر عملة ثم يبيعون، ويتركونك بالخسائر.

#### 3. عوائد مضمونة 💰
"احصل على 10% يومياً!" — لا يوجد شيء اسمه عوائد مضمونة.

#### 4. مواقع تبادل مزيّفة 🌐
مواقع تبدو مثل Binance أو Coinbase لكنها مزيّفة.

### كيف تحمي نفسك
- ❌ **لا تستثمر أكثر مما تتحمل خسارته**
- 🔍 **ابحث عن الفريق** — هل هم أشخاص حقيقيون؟
- 📋 **اقرأ الورقة البيضاء** — هل المشروع منطقي؟
- 🔐 **استخدم محفظة مادية** (Ledger/Trezor)
- ⚠️ **احذر من الوعود غير الواقعية**`,
    category: 'Tips',
    categoryAr: 'نصائح',
    date: '2025-03-28',
    readTime: '6 min',
    readTimeAr: '٦ دقائق',
    tags: ['Cryptocurrency', 'Scams', 'Crypto'],
    tagsAr: ['عملات رقمية', 'احتيال', 'كريبتو'],
  },
  {
    id: '14',
    title: 'SIM Swap Attacks — How They Steal Your Phone Number',
    titleAr: 'هجمات مبادلة الشريحة — كيف يسرقون رقم هاتفك',
    summary: 'SIM Swap attacks let hackers take control of your number and breach all your accounts.',
    summaryAr: 'هجمات مبادلة الشريحة تتيح للقراصنة السيطرة على رقمك واختراق كل حساباتك.',
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
    contentAr: `## مبادلة الشريحة: أخطر هجوم على الهواتف

القرصان يُقنع شركة الاتصالات بنقل رقمك لشريحة جديدة. هذا يمنحه كل رسائلك وأكواد التحقق.

### كيف يعمل الهجوم
1. القرصان يجمع معلومات عنك (الاسم، العنوان، رقم الهوية)
2. يتصل بشركة الاتصالات وينتحل هويتك
3. يطلب نقل الرقم لشريحة جديدة
4. يستقبل كل رسائلك وأكواد التحقق
5. يصل لحساباتك البنكية وبريدك الإلكتروني

### من في خطر؟
- أي شخص يعتمد على **الرسائل النصية للمصادقة الثنائية**
- **حاملو العملات الرقمية**
- **الشخصيات العامة** والمؤثرون

### كيف تحمي نفسك
1. **ضع رمز PIN على حساب شركة الاتصالات**
2. **استخدم تطبيق مصادقة** بدلاً من الرسائل النصية
3. **لا تشارك معلومات شخصية** على وسائل التواصل
4. **فعّل الإشعارات** على حساباتك البنكية`,
    category: 'Reports',
    categoryAr: 'تقارير',
    date: '2025-03-25',
    readTime: '5 min',
    readTimeAr: '٥ دقائق',
    tags: ['SIM Swap', 'Mobile', 'Hacking'],
    tagsAr: ['مبادلة شريحة', 'هاتف', 'اختراق'],
  },
  {
    id: '15',
    title: '🔴 URGENT: Google Warns of Critical Chrome Vulnerability — Update Now!',
    titleAr: '🔴 عاجل: جوجل تحذّر من ثغرة خطيرة في كروم — حدّث الآن!',
    summary: 'A zero-day vulnerability in Chrome is actively being exploited. 3 billion users at risk.',
    summaryAr: 'ثغرة يوم صفر في كروم يتم استغلالها حالياً. 3 مليار مستخدم في خطر.',
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
    contentAr: `## ثغرة كروم الجديدة

أصدرت جوجل تحديثاً طارئاً لكروم لإصلاح ثغرة **CVE-2025-2783** التي يتم استغلالها حالياً.

### ما مدى خطورتها؟
- 💀 **الخطورة: حرجة**
- 🌐 تؤثر على **جميع أنظمة التشغيل**
- 🎯 **يتم استغلالها حالياً** في هجمات حقيقية
- 🔓 تسمح بتنفيذ أكواد خبيثة على جهازك

### كيف تُحدّث كروم
1. افتح كروم
2. اضغط **⋮** (ثلاث نقاط) أعلى اليمين
3. **المساعدة ← حول Google Chrome**
4. كروم سيُحدّث تلقائياً
5. **أعد تشغيل المتصفح**

### بدائل أكثر أماناً
- **Brave** — مبني على Chromium مع حماية إضافية
- **Firefox** — محرك مختلف تماماً
- **Tor Browser** — أقصى خصوصية`,
    category: 'Breaking News',
    categoryAr: 'أخبار عاجلة',
    date: '2025-04-23',
    readTime: '2 min',
    readTimeAr: '٢ دقائق',
    tags: ['Chrome', 'Vulnerability', 'Breaking', 'Google'],
    tagsAr: ['كروم', 'ثغرة', 'عاجل', 'جوجل'],
    isNews: true,
  },
];

export const CATEGORIES = ['All', 'Breaking News', 'Data Breaches', 'Reports', 'Passwords', 'Phishing', 'Networks', 'Privacy', 'Tips'];
export const CATEGORIES_AR = ['الكل', 'أخبار عاجلة', 'اختراقات البيانات', 'تقارير', 'كلمات المرور', 'التصيّد الاحتيالي', 'الشبكات', 'الخصوصية', 'نصائح'];
