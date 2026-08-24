export interface QuizQuestion {
  id: string;
  question: string;
  questionAr: string;
  options: string[];
  optionsAr: string[];
  correctAnswerIndex: number;
  explanation: string;
  explanationAr: string;
}

export interface LessonSection {
  title: string;
  titleAr: string;
  content: string;
  contentAr: string;
  keyPoints?: string[];
  keyPointsAr?: string[];
}

export interface Lesson {
  id: string;
  title: string;
  titleAr: string;
  category: 'Fundamentals' | 'Authentication' | 'Threat Defense' | 'Privacy & OSINT';
  categoryAr: string;
  estimatedMinutes: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  difficultyAr: string;
  summary: string;
  summaryAr: string;
  sections: LessonSection[];
  quiz: QuizQuestion[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'phishing-recognition',
    title: 'Phishing Recognition & Social Engineering',
    titleAr: 'التعرف على التصيد الاحتيالي والهندسة الاجتماعية',
    category: 'Threat Defense',
    categoryAr: 'مكافحة التهديدات',
    estimatedMinutes: 8,
    difficulty: 'Beginner',
    difficultyAr: 'مبتدئ',
    summary: 'Master the psychological techniques attackers use in email, SMS, and voice scams, and learn foolproof verification habits.',
    summaryAr: 'تعلم الأساليب النفسية التي يستخدمها المهاجمون في رسائل البريد والمحادثات والمكالمات وكيفية كشفها بفعالية.',
    sections: [
      {
        title: 'The Psychology of Urgency and Authority',
        titleAr: 'علم نفس الإلحاح وانتحال السلطة',
        content: 'Phishing attacks succeed primarily by manipulating human emotion rather than exploiting software vulnerabilities. Attackers simulate high-urgency scenarios—such as account deactivation, unauthorized financial transfers, or critical security warnings—to bypass critical thinking.',
        contentAr: 'تنجح هجمات التصيد من خلال استغلال العواطف البشرية بدلاً من الثغرات البرمجية. يقوم المهاجمون بافتعال حالات طارئة مثل إيقاف الحساب أو سحب بنكي لتجاوز التفكير التحليلي للضحية.',
        keyPoints: [
          'Scammers create false deadlines (e.g. "Action required within 15 minutes").',
          'Impersonation targets authoritative entities (IT support, banks, government agencies).',
          'Context matters: spear phishing leverages public details from social media.',
        ],
        keyPointsAr: [
          'يخلق المحتالون مهلاً زمنية زائفة مثل (مطلوب إجراء فوري خلال 15 دقيقة).',
          'ينتحل المهاجم جهات ذات سلطة كالبنوك أو الدعم الفني أو الجهات الحكومية.',
          'التصيد الموجه يستغل المعلومات المتاحة على وسائل التواصل الاجتماعي.',
        ],
      },
      {
        title: 'Anatomy of a Malicious Message',
        titleAr: 'تشريح الرسالة الاحتيالية',
        content: 'Always inspect the sender address and domain carefully. Look for spoofed headers, lookalike domains (e.g., paypaI.com with capital I instead of l), mismatched sender names, and generic greetings.',
        contentAr: 'افحص دائماً عنوان البريد الإلكتروني والنطاق بعناية. انتبه للنطاقات المشابهة والتحويلات الخفية وتطابق اسم المرسل مع البريد الحقيقي.',
        keyPoints: [
          'Hover over links to verify the actual destination URL before clicking.',
          'Never trust urgent attachments containing macros (e.g. .docm, .xlsm) or archives (.zip, .iso).',
          'Use independent communication channels to verify unexpected requests.',
        ],
        keyPointsAr: [
          'مرر الفأرة فوق الروابط لمعاينة الوجهة الحقيقية قبل النقر.',
          'لا تفتح المرفقات المشبوهة أو ملفات الأرشيف المضغوطة.',
          'تواصل عبر وسيلة مستقلة للتحقق من أي طلب تحويل مالي أو أمني غير معتاد.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q1-1',
        question: 'What is the most common emotional trigger exploited in phishing emails?',
        questionAr: 'ما هو المحفز العاطفي الأكثر شيوعاً الذي يتم استغلاله في رسائل التصيد؟',
        options: [
          'Urgency and fear of loss or penalty',
          'Nostalgia and positive memories',
          'Intellectual curiosity about obscure facts',
          'Indifference and calm patience',
        ],
        optionsAr: [
          'الإلحاح والخوف من فقدان الحساب أو العقوبة',
          'الحنين والذكريات الإيجابية',
          'الفضول العلمي حول حقائق غامضة',
          'اللامبالاة والهدوء التام',
        ],
        correctAnswerIndex: 0,
        explanation: 'Attackers create artificial urgency to force hasty decisions before victims verify claims.',
        explanationAr: 'يخلق المهاجمون إلحاحاً زائفاً لدفع الضحية إلى اتخاذ قرارات متسرعة دون التحقق.',
      },
      {
        id: 'q1-2',
        question: 'If you receive an email from your bank asking for an OTP code, what should you do?',
        questionAr: 'إذا تلقيت بريداً من مصرفك يطلب رمز التأكيد (OTP)، فما هو التصرف الصحيح؟',
        options: [
          'Reply immediately with the code to prevent account suspension',
          'Never share the OTP and contact the bank directly through their official app or phone line',
          'Click the link to verify your identity on the provided form',
          'Forward the email to your friends for opinions',
        ],
        optionsAr: [
          'الرد فوراً بالرمز لتجنب تجميد الحساب',
          'عدم مشاركة الرمز إطلاقاً والتواصل مع البنك مباشرة عبر تطبيقه الرسمي أو رقمه المعتمد',
          'الضغط على الرابط وتأكيد البيانات في النموذج المرفق',
          'إعادة توجيه الرسالة لأصدقائك لأخذ رأيهم',
        ],
        correctAnswerIndex: 1,
        explanation: 'Banks and legitimate institutions will never ask for your one-time passwords via email or call.',
        explanationAr: 'البنوك والجهات الرسمية لا تطلب رموز التحقق لمرة واحدة عبر البريد أو الهاتف نهائياً.',
      },
    ],
  },
  {
    id: 'password-passphrase-hygiene',
    title: 'Password & Passphrase Hygiene',
    titleAr: 'إدارة كلمات المرور والعبارات السرية',
    category: 'Authentication',
    categoryAr: 'المصادقة وإدارة الهوية',
    estimatedMinutes: 7,
    difficulty: 'Beginner',
    difficultyAr: 'مبتدئ',
    summary: 'Understand why password reuse is fatal, how credential stuffing works, and why passphrases beat complex short passwords.',
    summaryAr: 'فهم خطورة إعادة استخدام كلمات المرور وهجمات حشو الاعتمادات، ولماذا تتفوق العبارات الطويلة على الرموز القصيرة.',
    sections: [
      {
        title: 'Entropy: Length Over Cryptic Complexity',
        titleAr: 'الإنتروبيا: الطول يتفوق على التعقيد الرمزي',
        content: 'Traditional password rules requiring special characters often resulted in predictable patterns (e.g. Password123!). Passphrases—four or more random, unrelated words—provide significantly higher computational entropy while remaining humanly memorable.',
        contentAr: 'السياسات القديمة التي تجبر على الرموز أدت لأنماط متوقعة مثل Password123!. استخدام عبارات المرور المكونة من 4 كلمات عشوائية غير مترابطة يوفر إنتروبيا وحصانة أقوى بكثير.',
        keyPoints: [
          'A 16-character passphrase is exponentially harder to crack than an 8-character complex string.',
          'Password managers eliminate cognitive overload and ensure 100% uniqueness.',
          'Never reuse master passwords across secondary accounts.',
        ],
        keyPointsAr: [
          'عبارة مرور من 16 حرفاً أصعب بمليارات المرات في الكسر من كلمة معقدة من 8 أحرف.',
          'مديرات كلمات المرور (Password Managers) تمنع التكرار تماماً وتولد كلمات عشوائية فريدة.',
          'لا تعد استخدام كلمة المرور الرئيسية في أي حساب ثانوي.',
        ],
      },
      {
        title: 'The Danger of Credential Stuffing',
        titleAr: 'خطر هجمات حشو الاعتمادات (Credential Stuffing)',
        content: 'When an obscure service is breached, automated botnets test the leaked username and password pairs across millions of high-value sites (Google, banking, PayPal). One leaked password can compromise every account sharing that credential.',
        contentAr: 'عند تسريب موقع غير مشهور، تقوم شبكات البوت باختبار البريد وكلمة المرور المسربة عبر ملايين المواقع الحيوية تلقائياً. كلمة سر مكررة واحدة تعرض كل حساباتك للخطر.',
        keyPoints: [
          'Every online service must have a distinct, randomly generated password.',
          'Use HaveIBeenPwned or JoeScan email audits to monitor for new credential leaks.',
        ],
        keyPointsAr: [
          'يجب أن يمتلك كل حساب كلمة سر عشوائية مستقلة تماماً.',
          'استخدم فحص البريد في JoeScan لمراقبة أي تسريب جديد لبياناتك.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q2-1',
        question: 'Which of the following offers the highest resistance against modern GPU brute-force attacks?',
        questionAr: 'أي من الخيارات التالية يوفر أعلى مقاومة ضد هجمات التخمين باستخدام كروت الشاشة الحديثة؟',
        options: [
          'A 16+ character random multi-word passphrase',
          'An 8-character word with one digit and exclamation mark (e.g. P@ssw0rd!)',
          'Your birthdate combined with your pet name',
          'The same strong password used on all websites',
        ],
        optionsAr: [
          'عبارة سرية عشوائية متعددة الكلمات بطول 16+ حرفاً',
          'كلمة من 8 أحرف تحتوي على رمز ورقم مثل P@ssw0rd!',
          'تاريخ ميلادك مدمجاً مع اسم حيوانك الأليف',
          'نفس كلمة المرور القوية مكررة في جميع الحسابات',
        ],
        correctAnswerIndex: 0,
        explanation: 'Length is the dominant factor in cryptographic entropy against offline brute force.',
        explanationAr: 'طول كلمة المرور هو العامل الحاسم في رفع صعوبة التخمين الحسابي.',
      },
    ],
  },
  {
    id: 'mfa-totp-webauthn',
    title: 'MFA & Why TOTP/WebAuthn Beats SMS',
    titleAr: 'المصادقة المتعددة ولماذا تتفوق TOTP وWebAuthn على SMS',
    category: 'Authentication',
    categoryAr: 'المصادقة وإدارة الهوية',
    estimatedMinutes: 9,
    difficulty: 'Intermediate',
    difficultyAr: 'متوسط',
    summary: 'Explore multi-factor authentication methods, SIM swap risks with SMS 2FA, and the impenetrable security of WebAuthn Passkeys.',
    summaryAr: 'تعرف على طرق المصادقة الثنائية ومخاطر تبديل الشريحة (SIM Swap) مع الرسائل النصية وقوة مفاتيح المرور Passkeys.',
    sections: [
      {
        title: 'The Vulnerabilities of SMS-Based 2FA',
        titleAr: 'ثغرات ونقاط ضعف المصادقة عبر الرسائل النصية (SMS)',
        content: 'SMS was never designed as a cryptographic channel. Telecommunication protocols (SS7) have known interception flaws, and attackers routinely execute SIM-swap fraud by socially engineering telecom representatives to transfer your phone number to their device.',
        contentAr: 'بروتوكولات الاتصالات لم تصمم كقنوات مشفرة آمنة. يمكن للمهاجمين اعتراض الرسائل عبر ثغرات SS7 أو نقل رقم هاتفك لشريحتهم عبر الاحتيال على موظفي شركة الاتصالات (SIM Swapping).',
        keyPoints: [
          'SMS codes can be intercepted via malware or telecommunication routing attacks.',
          'SIM swapping transfers incoming calls and SMS verification codes to the attacker.',
          'SMS is better than no 2FA, but should be replaced with app-based TOTP or hardware keys.',
        ],
        keyPointsAr: [
          'يمكن اعتراض رسائل SMS عبر البرمجيات الخبيثة أو التلاعب بمسارات الاتصال.',
          'تبديل الشريحة يوجه كل رسائل ورموز التفعيل إلى جهاز المهاجم.',
          'الرسائل النصية أفضل من عدم وجود حماية، لكن يجب استبدالها بتطبيقات التوثيق أو مفاتيح الأمان.',
        ],
      },
      {
        title: 'TOTP Apps and FIDO2 / WebAuthn Passkeys',
        titleAr: 'تطبيقات TOTP ومفاتيح المرور FIDO2 / WebAuthn',
        content: 'Time-Based One-Time Passwords (TOTP, RFC 6238) generate 6-digit codes locally using a shared secret and Unix timestamps. FIDO2 / WebAuthn hardware keys and Passkeys use public-key cryptography bound to the website domain, making phishing mathematically impossible.',
        contentAr: 'تولد تطبيقات TOTP رموزاً كل 30 ثانية محلياً دون اتصال بالشبكة. بينما توفر مفاتيح FIDO2 وPasskeys حماية كاملة ومقاومة مطلقة للتصيد لأنها ترتبط بنطاق الموقع الحقيقي بتشفير المفتاح العام.',
        keyPoints: [
          'TOTP apps (e.g. Aegis, 2FAS, Bitwarden) do not rely on cellular networks.',
          'WebAuthn Passkeys verify domain origin, defeating real-time reverse proxies (e.g., Evilginx).',
          'Store backup emergency recovery codes in a secure, encrypted offline vault.',
        ],
        keyPointsAr: [
          'تطبيقات TOTP تعمل محلياً دون الحاجة لشبكة الهاتف أو استقبال رسائل.',
          'مفاتيح Passkeys تتحقق من اسم النطاق الأصلي وتفشل محاولات خوادم التصيد العكسية.',
          'احتفظ بأكواد الاسترجاع الاحتياطية (Recovery Codes) في مكان آمن ومشفر.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q3-1',
        question: 'Why is FIDO2 / WebAuthn (Passkeys) considered immune to real-time phishing proxies?',
        questionAr: 'لماذا تعتبر مفاتيح FIDO2 / WebAuthn محصنة ضد خوادم التصيد في الوقت الفعلي؟',
        options: [
          'Because the cryptographic signature is strictly bound to the real origin domain by the browser',
          'Because it uses longer text passwords',
          'Because it requires an active internet connection to telecom towers',
          'Because it sends SMS codes to multiple devices simultaneously',
        ],
        optionsAr: [
          'لأن المتصفح يربط التوقيع الرقمي بنطاق الموقع الأصلي حصراً',
          'لأنها تستخدم كلمات مرور نصية أطول',
          'لأنها تعتمد على أبراج الاتصالات الخلوية',
          'لأنها ترسل رسائل SMS لعدة أجهزة معاً',
        ],
        correctAnswerIndex: 0,
        explanation: 'WebAuthn binds authentication signatures to the exact origin domain, so a fake lookalike site cannot extract or replay credentials.',
        explanationAr: 'يربط المتصفح ومفتاح الأمان التوقيع التشفيري بالنطاق الفعلي للموقع مما يبطل أي موقع وسيط مزيف.',
      },
    ],
  },
  {
    id: 'data-breaches-identity-exposure',
    title: 'Data Breaches & Identity Exposure',
    titleAr: 'تسريبات البيانات وانكشاف الهوية الرقمية',
    category: 'Privacy & OSINT',
    categoryAr: 'الخصوصية واستخبارات المصادر المفتوحة',
    estimatedMinutes: 8,
    difficulty: 'Intermediate',
    difficultyAr: 'متوسط',
    summary: 'Learn how massive database leaks occur, what dark web aggregators trade, and how to execute proactive incident containment.',
    summaryAr: 'تعرف على كيفية حدوث تسريبات قواعد البيانات الضخمة، وما يتم تداوله على الدارك ويب، وخطوات احتواء الخروقات.',
    sections: [
      {
        title: 'How Data Breaches Happen',
        titleAr: 'كيف تحدث تسريبات قواعد البيانات؟',
        content: 'Data breaches stem from SQL injection, unsecured cloud storage buckets (e.g. public S3), compromised employee credentials, or third-party vendor supply chain breaches. Once stolen, data is aggregated into colossal "Combo Lists" and infostealer malware logs.',
        contentAr: 'تحدث التسريبات عبر ثغرات مثل SQLi أو تخزين سحابي غير محمي أو سرقة حسابات الموظفين وسلاسل الإمداد. بعد السرقة، يتم تجميع البيانات في قوائم ضخمة وسجلات برمجيات التجسس.',
        keyPoints: [
          'Leaked datasets frequently include hashed passwords, phone numbers, addresses, and national IDs.',
          'Infostealer logs (RedLine, Lumma, Vidar) capture browser cookies, session tokens, and autofill vaults.',
        ],
        keyPointsAr: [
          'تتضمن البيانات المسربة كلمات المرور المشفرة وأرقام الهواتف والعناوين والهويات.',
          'سجلات Infostealer تسرق ملفات الكوكيز والجلسات المفتوحة وبيانات الحفظ التلقائي.',
        ],
      },
      {
        title: 'Post-Breach Incident Containment Protocol',
        titleAr: 'بروتوكول التعامل واحتواء ما بعد التسريب',
        content: 'When informed that your email or account was part of a breach, act immediately. Rotate credentials starting with root accounts (email, identity providers, financial portals) and revoke active session tokens.',
        contentAr: 'عند علمك بتسريب حسابك، بادر فوراً بتغيير كلمات المرور بدءاً من البريد الأساسي والخدمات البنكية وإلغاء تسجيل الدخول من جميع الأجهزة.',
        keyPoints: [
          'Change passwords immediately on all associated services.',
          'Terminate active sessions across Google, Apple, and social accounts.',
          'Enable transaction alerts on credit and banking cards.',
        ],
        keyPointsAr: [
          'غيّر كلمات المرور فوراً على الحساب المتأثر والخدمات المشابهة.',
          'أنهِ جميع الجلسات النشطة وسجل الخروج من كافة الأجهزة.',
          'فعّل إشعارات السحب الفوري على بطاقاتك المصرفية.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q4-1',
        question: 'What is the most urgent step when you discover your master email address was compromised in a breach?',
        questionAr: 'ما هي الخطوة الأكثر إلحاحاً عند اكتشاف تسريب بريدك الإلكتروني الأساسي؟',
        options: [
          'Change the email password, revoke all active sessions, and verify MFA is active',
          'Ignore the notification if your bank account is still accessible',
          'Delete your email account permanently without backup',
          'Forward the notification to social media contacts',
        ],
        optionsAr: [
          'تغيير كلمة مرور البريد فوراً وإنهاء الجلسات النشطة والتأكد من تفعيل المصادقة الثنائية',
          'تجاهل الإشعار طالما الحساب البنكي يعمل',
          'حذف حساب البريد نهائياً دون أخذ نسخة احتياطية',
          'نشر الإشعار على شبكات التواصل الاجتماعي',
        ],
        correctAnswerIndex: 0,
        explanation: 'Your primary email is the gateway to password resets across all other connected services.',
        explanationAr: 'البريد الإلكتروني الأساسي هو بوابة استعادة كلمات المرور لجميع حساباتك الأخرى.',
      },
    ],
  },
  {
    id: 'safe-browsing-link-inspection',
    title: 'Safe Browsing & Link Inspection',
    titleAr: 'التصفح الآمن وفحص الروابط والمواقع',
    category: 'Fundamentals',
    categoryAr: 'أساسيات الأمان',
    estimatedMinutes: 7,
    difficulty: 'Beginner',
    difficultyAr: 'مبتدئ',
    summary: 'Learn how to detect deceptive URLs, homograph attacks, malicious redirects, and weaponized short links before visiting them.',
    summaryAr: 'تعلم كيفية كشف الروابط الخبيثة وهجمات الحروف المتشابهة (Homograph) والتحويلات المشبوهة واختصار الروابط.',
    sections: [
      {
        title: 'Homograph and Typosquatting Attacks',
        titleAr: 'هجمات الأحرف المتطابقة (Homograph) والتلاعب الإملائي',
        content: 'Attackers register lookalike domains using internationalized domain names (IDN) with Cyrillic or Greek characters that look identical to Latin letters (e.g. google.com vs gооgle.com with Cyrillic "о"). Modern browsers show Punycode (xn--...) for suspicious domain registrations.',
        contentAr: 'يسجل المهاجمون نطاقات متشابهة باستخدام أحرف من لغات أخرى مثل السيريلية تشبه اللاتينية تماماً. تظهر المتصفحات هذه النطاقات بصيغة Punycode المشفرة لكشفها.',
        keyPoints: [
          'Check the address bar for strange Punycode prefixes (e.g., xn--...).',
          'Be vigilant with URL shorteners (bit.ly, t.co) — use URL expanders before opening unknown links.',
          'SSL/TLS (HTTPS padlock) only means traffic is encrypted, NOT that the website is trustworthy.',
        ],
        keyPointsAr: [
          'انتبه لظهور بادئات Punycode مثل xn-- في شريط العنوان.',
          'احذر من الروابط المختصرة واستخدم أدوات فك الاختصار قبل الفتح.',
          'وجود قفل HTTPS يعني فقط تشفير الاتصال ولا يعني أبداً أن الموقع موثوق أو آمن.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q5-1',
        question: 'Does the presence of a green HTTPS padlock guarantee that a website is legitimate and safe?',
        questionAr: 'هل يعني وجود قفل HTTPS الأخضر أن الموقع موثوق وآمن حتماً؟',
        options: [
          'No, HTTPS only encrypts communication in transit; malicious phishing sites can easily obtain free SSL certificates',
          'Yes, HTTPS is only granted to certified government and legitimate corporate websites',
          'Yes, search engines block all malicious sites with HTTPS',
          'No, HTTPS means your connection is insecure and public',
        ],
        optionsAr: [
          'لا، قفل HTTPS يعني فقط تشفير الاتصال أثناء النقل، ومواقع التصيد تستخرج شهادات SSL مجانية بسهولة',
          'نعم، شهادات HTTPS لا تُمنح إلا للشركات والمؤسسات المعتمدة فقط',
          'نعم، محركات البحث تمنع أي موقع خبيث من تفعيل HTTPS',
          'لا، HTTPS يعني أن الاتصال غير آمن',
        ],
        correctAnswerIndex: 0,
        explanation: 'Free automated certificates (Let’s Encrypt) mean over 80% of phishing websites now utilize valid HTTPS.',
        explanationAr: 'توفر شهادات الأمان المجانية التشفير لأكثر من 80% من مواقع التصيد الخبيثة.',
      },
    ],
  },
  {
    id: 'osint-privacy-footprint',
    title: 'OSINT Fundamentals & Privacy Footprint',
    titleAr: 'أساسيات استخبارات المصادر المفتوحة والخصوصية الرقمية',
    category: 'Privacy & OSINT',
    categoryAr: 'الخصوصية واستخبارات المصادر المفتوحة',
    estimatedMinutes: 9,
    difficulty: 'Intermediate',
    difficultyAr: 'متوسط',
    summary: 'Discover how investigators and threat actors correlate usernames, phone numbers, and image metadata to profile individuals.',
    summaryAr: 'اكتشف كيف يقوم الباحثون والمهاجمون بربط الأسماء المستعارة وأرقام الهواتف والبيانات الوصفية للصور لتتبع الهوية.',
    sections: [
      {
        title: 'Digital Footprint and Metadata Leaks',
        titleAr: 'البصمة الرقمية وتسريب البيانات الوصفية (Metadata)',
        content: 'Every photo taken with a smartphone contains EXIF metadata: exact GPS coordinates, camera model, lens aperture, and timestamp. Posting unstripped media publicly exposes your physical location history.',
        contentAr: 'تحتوي الصور الملتقطة بالهاتف على بيانات EXIF وصفية مثل إحداثيات GPS الدقيقة ونوع الكاميرا والتوقيت. نشر الصور دون مسح هذه البيانات يكشف موقعك الجغرافي.',
        keyPoints: [
          'Strip EXIF data before uploading photos to forums or cloud repositories.',
          'Avoid using a uniform username across personal, professional, and gaming platforms.',
          'Periodically perform self-OSINT searches on Google, Sherlock, and JoeScan.',
        ],
        keyPointsAr: [
          'امسح بيانات EXIF من الصور قبل مشاركتها.',
          'تجنب توحيد الاسم المستعار عبر الحسابات الشخصية والمهنية والألعاب.',
          'أجرِ بحثاً ذاتياً دورياً عبر محركات البحث وأدوات OSINT كـ JoeScan.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q6-1',
        question: 'What sensitive information is frequently embedded in raw photo files taken by modern smartphones?',
        questionAr: 'ما هي المعلومات الحساسة التي تتضمنها ملفات الصور الخام الملتقطة بالهواتف الذكية؟',
        options: [
          'EXIF metadata including exact GPS latitude/longitude coordinates and capture timestamp',
          'Your bank account routing number',
          'Your Wi-Fi router password',
          'Your operating system master encryption key',
        ],
        optionsAr: [
          'بيانات EXIF الوصفية بما فيها إحداثيات GPS الجغرافية وتوقيت الالتقاط',
          'رقم الحساب البنكي',
          'كلمة سر شبكة الواي فاي',
          'مفتاح تشفير نظام التشغيل',
        ],
        correctAnswerIndex: 0,
        explanation: 'Smartphone cameras embed geographic location coordinates into EXIF tags unless explicitly disabled in camera permissions.',
        explanationAr: 'تدمج كاميرات الهواتف إحداثيات الموقع الجغرافي في بيانات EXIF ما لم يتم تعطيل إذن الموقع.',
      },
    ],
  },
];
