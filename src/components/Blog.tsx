import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Calendar, Clock, ChevronRight, ArrowRight, Tag, TrendingUp, Shield, AlertTriangle, Eye, Lock, Wifi, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  date: string;
  readTime: string;
  tags: string[];
  featured?: boolean;
}

const ARTICLES: Article[] = [
  {
    id: '1',
    title: 'أكبر 10 تسريبات بيانات في عام 2025 — هل بياناتك من ضمنهم؟',
    summary: 'شهد عام 2025 موجة غير مسبوقة من تسريبات البيانات التي أثرت على مليارات المستخدمين حول العالم. تعرف على أخطر التسريبات وكيف تحمي نفسك.',
    content: `## أكبر 10 تسريبات بيانات في عام 2025

شهد العالم الرقمي في 2025 تصاعداً مخيفاً في حجم ونوعية تسريبات البيانات. فيما يلي أخطر 10 تسريبات والدروس المستفادة منها:

### 1. تسريب National Public Data — 2.9 مليار سجل
في بداية 2025، تم تسريب قاعدة بيانات ضخمة تحتوي على بيانات شخصية لملايين الأشخاص بما في ذلك أرقام الضمان الاجتماعي والعناوين.

**الدرس المستفاد:** لا تثق في أي شركة تخزن بياناتك — حتى لو كانت شركة حكومية.

### 2. اختراق MOVEit — سلسلة توريد كاملة
استغل المهاجمون ثغرة zero-day في برنامج نقل الملفات MOVEit مما أثر على آلاف الشركات والمؤسسات.

**الدرس المستفاد:** الأمان ليس فقط في نظامك — بل في أنظمة مورديك أيضاً.

### 3. تسريب ChatGPT — محادثات ملايين المستخدمين
تم تسريب تاريخ محادثات ملايين المستخدمين مع ChatGPT بما في ذلك معلومات حساسة شاركوها مع الذكاء الاصطناعي.

**الدرس المستفاد:** لا تشارك معلومات شخصية أو سرية مع أدوات الذكاء الاصطناعي.

### 4. اختراق AT&T — 73 مليون عميل
تم تسريب بيانات 73 مليون عميل بما في ذلك أرقام الضمان الاجتماعي وكلمات المرور المشفرة.

### 5. هجوم الفدية على مستشفيات — أرواح في خطر
استهدفت مجموعات ransomware مستشفيات في عدة دول عربية مما أدى لتوقف أنظمة حيوية.

---

## كيف تحمي نفسك؟

1. **استخدم مدير كلمات مرور** — لا تستخدم نفس الكلمة في أكثر من موقع
2. **فعّل المصادقة الثنائية (2FA)** على كل حساباتك
3. **راقب بياناتك** باستمرار باستخدام أدوات مثل JoeScan
4. **لا تشارك معلومات حساسة** على الإنترنت أبداً
5. **حدّث برامجك** فوراً عند صدور تحديثات أمنية`,
    category: 'تسريبات',
    date: '2025-04-20',
    readTime: '7 دقائق',
    tags: ['تسريبات', 'حماية البيانات', '2025'],
    featured: true,
  },
  {
    id: '2',
    title: 'كلمة المرور "123456" لسه الأكثر استخداماً — كيف تحمي حساباتك؟',
    summary: 'رغم كل التحذيرات، لا يزال ملايين المستخدمين يستخدمون كلمات مرور ضعيفة. دليلك الشامل لإنشاء كلمات مرور لا يمكن اختراقها.',
    content: `## لماذا كلمة المرور "123456" مشكلة حقيقية؟

حسب تقرير NordPass لعام 2025، فإن كلمة المرور "123456" لا تزال **الأكثر استخداماً عالمياً** للعام الخامس على التوالي. هذه كلمة مرور يمكن كسرها في **أقل من ثانية واحدة**.

### أكثر 10 كلمات مرور شيوعاً (وخطورة):

| الترتيب | كلمة المرور | وقت الكسر |
|---------|------------|-----------|
| 1 | 123456 | أقل من ثانية |
| 2 | password | أقل من ثانية |
| 3 | 123456789 | أقل من ثانية |
| 4 | 12345678 | أقل من ثانية |
| 5 | qwerty123 | أقل من ثانية |

### كيف تنشئ كلمة مرور قوية؟

**الطريقة المثالية:** استخدم **جملة** بدل كلمة واحدة:
- ❌ \`ahmed123\`
- ✅ \`أحب_القهوة_الساعة_7_صباحاً!\`

**قواعد الكلمة القوية:**
1. **12 حرف على الأقل** — كل حرف إضافي يضاعف الصعوبة
2. **أحرف كبيرة وصغيرة** — تزيد التعقيد
3. **أرقام ورموز** — مثل @, #, $, %
4. **لا تستخدم معلومات شخصية** — اسمك، تاريخ ميلادك، اسم حيوانك

### استخدم مدير كلمات مرور

مدير كلمات المرور يحفظ كل كلمات المرور بشكل آمن ويولد كلمات عشوائية قوية:
- **Bitwarden** (مجاني ومفتوح المصدر)
- **1Password** (مدفوع ولكن ممتاز)
- **KeePass** (مجاني ويعمل بدون إنترنت)

### المصادقة الثنائية: خط الدفاع الأخير

حتى لو سُرقت كلمة المرور، المصادقة الثنائية تمنع الوصول:
- **تطبيق Authenticator** (الأفضل) — Google Authenticator أو Authy
- **رسالة SMS** (مقبول) — أفضل من لا شيء
- **مفتاح أمان فعلي** (الأقوى) — YubiKey

---

💡 **نصيحة:** افحص كلمات المرور الحالية باستخدام أداة "فحص كلمات المرور" في JoeScan لمعرفة إذا كانت مسربة.`,
    category: 'كلمات المرور',
    date: '2025-04-18',
    readTime: '5 دقائق',
    tags: ['كلمات المرور', 'حماية الحسابات', 'نصائح'],
  },
  {
    id: '3',
    title: 'رسائل التصيد الاحتيالي بالعربي — أساليب جديدة وخطيرة',
    summary: 'المحتالون أصبحوا أذكى! تعرف على أحدث أساليب التصيد الاحتيالي التي تستهدف المستخدمين العرب وكيف تكشفها.',
    content: `## التصيد الاحتيالي بالعربي: موجة جديدة من الاحتيال

في 2025، شهدنا زيادة **300%** في رسائل التصيد الاحتيالي باللغة العربية. المحتالون أصبحوا يستخدمون الذكاء الاصطناعي لكتابة رسائل مقنعة جداً.

### أشهر أنواع التصيد في المنطقة العربية:

#### 1. رسائل البنك المزيفة 🏦
"عزيزي العميل، تم تجميد حسابك. اضغط هنا لتحديث بياناتك."
- **الحقيقة:** البنك لا يطلب بياناتك عبر إيميل أو SMS أبداً

#### 2. عروض التوظيف الوهمية 💼
"مبروك! تم قبولك في وظيفة بمرتب 50,000 ريال/شهر. ادفع رسوم التسجيل..."
- **الحقيقة:** الوظائف الحقيقية لا تطلب رسوم تسجيل

#### 3. جوائز مسابقات لم تشترك فيها 🎁
"ربحت iPhone 16 Pro! ادخل بياناتك لاستلام الجائزة."
- **الحقيقة:** لا أحد يقدم هدايا مجانية لأشخاص لا يعرفهم

#### 4. رسائل شركات الشحن 📦
"طردك في الطريق! ادفع رسوم الجمارك لاستلامه."
- **الحقيقة:** تواصل مع شركة الشحن مباشرة من موقعها الرسمي

### كيف تكشف رسالة التصيد؟

| العلامة | التفاصيل |
|---------|----------|
| 🔴 عنوان المرسل غريب | تحقق من البريد الإلكتروني كاملاً |
| 🔴 أخطاء إملائية | الشركات الكبرى لا تخطئ إملائياً |
| 🔴 عاجل جداً! | يحاولون إخافتك لتتصرف بسرعة |
| 🔴 روابط مشبوهة | مرر الماوس فوق الرابط قبل الضغط |
| 🔴 طلب معلومات شخصية | لا تشارك بياناتك أبداً عبر رابط |

### ماذا تفعل لو تلقيت رسالة مشبوهة؟

1. **لا تضغط على أي رابط**
2. **لا ترد على الرسالة**
3. **افحص الرابط** باستخدام أداة "فحص الروابط المشبوهة" في JoeScan
4. **بلّغ عن الرسالة** لمزود خدمة البريد
5. **احذف الرسالة** فوراً

---

🛡️ **استخدم أداة فحص الرسائل المشبوهة** في JoeScan لتحليل أي رسالة تثير شكوكك.`,
    category: 'التصيد',
    date: '2025-04-15',
    readTime: '6 دقائق',
    tags: ['تصيد احتيالي', 'حماية', 'نصائح'],
  },
  {
    id: '4',
    title: 'واي فاي المقاهي والفنادق — لماذا هو خطير وكيف تحمي نفسك؟',
    summary: 'شبكات الواي فاي العامة هي جنة المخترقين. تعلم كيف تتصفح بأمان عندما تكون خارج المنزل.',
    content: `## شبكات الواي فاي العامة: الخطر المخفي

كل مرة تتصل بشبكة واي فاي في مقهى أو فندق أو مطار، أنت **تعرض بياناتك للخطر**. المخترقون يستغلون هذه الشبكات بعدة طرق:

### كيف يسرقون بياناتك؟

#### 1. هجوم Man-in-the-Middle (الرجل في المنتصف) 👤
المخترق يضع نفسه بينك وبين الراوتر ويقرأ كل ما ترسله وتستقبله.

#### 2. Evil Twin (التوأم الشرير) 👥
ينشئ شبكة واي فاي بنفس اسم شبكة المقهى. تتصل بها ظناً أنها الشبكة الحقيقية، لكنها فخ.

#### 3. Packet Sniffing (التنصت على البيانات) 📡
باستخدام أدوات بسيطة، يستطيع أي شخص على نفس الشبكة التقاط بياناتك غير المشفرة.

### ماذا يمكنهم سرقته؟

- 🔐 كلمات المرور
- 💳 بيانات البطاقة البنكية
- 📧 رسائل البريد الإلكتروني
- 📱 رسائل الواتساب (في بعض الحالات)
- 🍪 ملفات الكوكيز (يمكنهم تسجيل الدخول لحساباتك)

### كيف تحمي نفسك؟

#### ✅ استخدم VPN دائماً
VPN يشفر كل بياناتك ويجعلها غير قابلة للقراءة حتى لو اعترضها أحد.
- **ProtonVPN** — مجاني وآمن
- **NordVPN** — سريع وموثوق
- **Mullvad** — خصوصية قصوى

#### ✅ تأكد من HTTPS
- ابحث عن 🔒 في شريط العنوان
- لا تدخل بيانات في مواقع HTTP (بدون S)

#### ✅ أوقف الاتصال التلقائي
- في إعدادات الواي فاي، أوقف "الاتصال التلقائي بالشبكات المفتوحة"

#### ✅ استخدم بيانات الموبايل للعمليات الحساسة
- الشراء أونلاين؟ استخدم 4G/5G
- تسجيل دخول للبنك؟ استخدم 4G/5G

#### ✅ فعّل الجدار الناري (Firewall)
- في Windows: ابحث عن "Windows Firewall" وتأكد إنه مفعل
- في Mac: System Preferences → Security & Privacy → Firewall

---

🔍 **افحص أمان شبكتك** باستخدام أداة "فحص IP" في JoeScan.`,
    category: 'شبكات',
    date: '2025-04-10',
    readTime: '8 دقائق',
    tags: ['واي فاي', 'VPN', 'شبكات عامة'],
  },
  {
    id: '5',
    title: 'بصمتك الرقمية — الإنترنت يعرف عنك أكثر مما تظن',
    summary: 'كل نقرة، كل بحث، كل صورة — الإنترنت يتذكر كل شيء. تعلم كيف تقلل بصمتك الرقمية وتحمي خصوصيتك.',
    content: `## بصمتك الرقمية: ماذا يعرف عنك الإنترنت؟

في كل مرة تستخدم الإنترنت، تترك **بصمة رقمية**. هذه البصمة تتضمن معلومات أكثر بكثير مما تتخيل:

### ماذا يعرف عنك الإنترنت؟

- 📍 **موقعك الجغرافي** — بدقة تصل لعدة أمتار
- 🖥️ **جهازك** — نوعه، نظام التشغيل، دقة الشاشة
- 🌐 **متصفحك** — الإضافات المثبتة، اللغة، الخطوط
- 🕐 **عاداتك** — متى تتصل، ماذا تبحث، ماذا تشتري
- 👤 **هويتك** — حتى لو لم تسجل دخولك، يمكن تتبعك

### أنواع البصمة الرقمية

#### بصمة نشطة (Active Footprint)
ما تشاركه بنفسك عمداً:
- منشورات السوشيال ميديا
- التعليقات والمراجعات
- الصور والفيديوهات
- المعلومات في ملفاتك الشخصية

#### بصمة سلبية (Passive Footprint)
ما يُجمع عنك بدون علمك:
- سجل التصفح
- عنوان IP
- ملفات الكوكيز
- بيانات التطبيقات

### كيف تقلل بصمتك الرقمية؟

#### 1. راجع إعدادات الخصوصية 🔧
- Facebook: Settings → Privacy
- Google: myaccount.google.com → Privacy
- Instagram: Settings → Privacy

#### 2. احذف الحسابات القديمة 🗑️
- استخدم موقع justdelete.me لمعرفة كيف تحذف حساباتك
- احذف التطبيقات اللي مش بتستخدمها

#### 3. استخدم محرك بحث يحترم خصوصيتك 🔍
- **DuckDuckGo** — لا يتتبعك أبداً
- **Brave Search** — خصوصية مدمجة
- **Startpage** — يستخدم نتائج Google بدون التتبع

#### 4. استخدم بريد إلكتروني مشفر 📧
- **ProtonMail** — مشفر من طرف لطرف
- **Tutanota** — بديل ممتاز

#### 5. راجع بياناتك المسربة بانتظام 🛡️
- استخدم JoeScan لفحص إيميلك وأرقامك
- غيّر كلمات المرور المسربة فوراً

---

🔍 **اكتشف بصمتك الرقمية** باستخدام أداة "بصمة المتصفح" في JoeScan — ستندهش من كمية المعلومات التي يكشفها متصفحك!`,
    category: 'خصوصية',
    date: '2025-04-05',
    readTime: '9 دقائق',
    tags: ['خصوصية', 'بصمة رقمية', 'تتبع'],
  },
];

const CATEGORY_ICONS: Record<string, any> = {
  'تسريبات': AlertTriangle,
  'كلمات المرور': Lock,
  'التصيد': Eye,
  'شبكات': Wifi,
  'خصوصية': Shield,
};

export default function Blog() {
  const { lang } = useLanguage();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const featured = ARTICLES.find(a => a.featured);
  const rest = ARTICLES.filter(a => !a.featured);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-black uppercase tracking-widest text-text-main">مدوّنة الأمن السيبراني</h1>
          <p className="text-xs text-text-dim font-mono">مقالات ونصائح لحمايتك الرقمية — بالعربي</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedArticle ? (
          /* Full Article View */
          <motion.div
            key="article"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <button
              onClick={() => setSelectedArticle(null)}
              className="flex items-center gap-2 text-sm text-accent hover:underline font-bold"
            >
              <ArrowRight className="w-4 h-4" />
              العودة للمقالات
            </button>

            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 sm:p-8 space-y-6">
              {/* Article Header */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest rounded-lg border border-accent/20">
                    {selectedArticle.category}
                  </span>
                  <span className="text-[10px] text-text-dim font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(selectedArticle.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className="text-[10px] text-text-dim font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedArticle.readTime} قراءة
                  </span>
                </div>
                <h1 className="text-2xl font-black text-text-main leading-relaxed">{selectedArticle.title}</h1>
              </div>

              {/* Article Content */}
              <div className="prose prose-invert max-w-none">
                {selectedArticle.content.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-text-main mt-8 mb-4 border-b border-border-subtle pb-2">{line.replace('## ', '')}</h2>;
                  if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-accent mt-6 mb-3">{line.replace('### ', '')}</h3>;
                  if (line.startsWith('#### ')) return <h4 key={i} className="text-base font-bold text-text-main mt-4 mb-2">{line.replace('#### ', '')}</h4>;
                  if (line.startsWith('- ')) return <li key={i} className="text-sm text-text-dim mr-4 mb-1 list-disc leading-relaxed">{line.replace('- ', '')}</li>;
                  if (line.startsWith('| ')) {
                    const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
                    if (cells.every(c => c.match(/^[-:]+$/))) return null;
                    return (
                      <div key={i} className="flex border-b border-border-subtle">
                        {cells.map((cell, ci) => (
                          <div key={ci} className="flex-1 py-2 px-3 text-xs text-text-dim font-mono">{cell}</div>
                        ))}
                      </div>
                    );
                  }
                  if (line.startsWith('---')) return <hr key={i} className="border-border-subtle my-6" />;
                  if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-sm font-bold text-text-main mb-2">{line.replace(/\*\*/g, '')}</p>;
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i} className="text-sm text-text-dim leading-relaxed mb-2">{line}</p>;
                })}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border-subtle">
                {selectedArticle.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-bg-base border border-border-subtle rounded-lg text-[10px] text-text-dim font-mono">
                    <Tag className="w-3 h-3" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Article List */
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Featured Article */}
            {featured && (
              <motion.div
                whileHover={{ scale: 1.005 }}
                onClick={() => setSelectedArticle(featured)}
                className="bg-gradient-to-br from-accent/10 via-bg-surface to-purple-500/5 border border-accent/20 rounded-2xl p-6 cursor-pointer hover:border-accent/40 transition-all relative overflow-hidden group"
              >
                <div className="absolute top-3 left-3 px-2 py-0.5 bg-accent/20 text-accent text-[10px] font-bold uppercase tracking-widest rounded-lg border border-accent/30 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> مقال مميز
                </div>
                <div className="space-y-3 mt-6">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 bg-bg-base border border-border-subtle rounded-lg text-[10px] text-text-dim font-mono">
                      {featured.category}
                    </span>
                    <span className="text-[10px] text-text-dim font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(featured.date).toLocaleDateString('ar-EG', { month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-text-main leading-relaxed">{featured.title}</h2>
                  <p className="text-sm text-text-dim leading-relaxed">{featured.summary}</p>
                  <div className="flex items-center gap-2 text-accent text-xs font-bold pt-2">
                    اقرأ المقال <ChevronRight className="w-4 h-4 group-hover:translate-x-[-4px] transition-transform rotate-180" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Other Articles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rest.map((article, idx) => {
                const CatIcon = CATEGORY_ICONS[article.category] || Shield;
                return (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => setSelectedArticle(article)}
                    className="bg-bg-surface border border-border-subtle rounded-2xl p-5 cursor-pointer hover:border-accent/30 transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center shrink-0 mt-1">
                        <CatIcon className="w-5 h-5 text-accent" />
                      </div>
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-text-dim font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(article.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-[10px] text-text-dim font-mono">• {article.readTime}</span>
                        </div>
                        <h3 className="font-bold text-sm text-text-main leading-relaxed line-clamp-2">{article.title}</h3>
                        <p className="text-xs text-text-dim leading-relaxed line-clamp-2">{article.summary}</p>
                        <div className="flex items-center gap-1 text-accent text-[10px] font-bold pt-1">
                          اقرأ المزيد <ChevronRight className="w-3 h-3 group-hover:translate-x-[-3px] transition-transform rotate-180" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
