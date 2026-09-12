import '../styles/focus-blog.css';
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Calendar, Clock, ChevronRight, ArrowRight, Tag, TrendingUp, Shield, AlertTriangle, Eye, Lock, Wifi, X, Zap, Newspaper, Filter, Search, Smartphone, Brain, Baby, Bitcoin, CreditCard, Globe, ExternalLink, Radio, RefreshCw, Link2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ARTICLES, CATEGORIES, CATEGORIES_AR, type Article } from '../data/blogArticles';

interface DailyNewsTranslation {
  title: string;
  summary: string;
  content: string;
}

interface DailyNewsItem {
  title: string;
  link: string;
  date: string;
  source: string;
  summary: string;
  content?: string;
  translations?: Record<string, DailyNewsTranslation>;
}

const CATEGORY_ICONS: Record<string, any> = {
  'Data Breaches': AlertTriangle,
  'Passwords': Lock,
  'Phishing': Eye,
  'Networks': Wifi,
  'Privacy': Shield,
  'Breaking News': Zap,
  'Reports': Brain,
  'Tips': Smartphone,
};

// Blog UI translations — all 7 languages
const blogT: Record<string, Record<string, string>> = {
  header: { en: 'Cybersecurity Blog', ar: 'مدونة الأمن السيبراني', fr: 'Blog Cybersécurité', de: 'Cybersicherheitsblog', es: 'Blog de Ciberseguridad', tr: 'Siber Güvenlik Blogu', ru: 'Блог кибербезопасности' },
  subtitle: { en: 'Articles & news to protect your digital life', ar: 'مقالات وأخبار لحماية حياتك الرقمية', fr: 'Articles et actualités pour protéger votre vie numérique', de: 'Artikel und Nachrichten zum Schutz Ihres digitalen Lebens', es: 'Artículos y noticias para proteger tu vida digital', tr: 'Dijital hayatınızı korumak için makaleler ve haberler', ru: 'Статьи и новости для защиты вашей цифровой жизни' },
  autoDaily: { en: 'Auto Daily Updates', ar: 'تحديت يومي تلقائي', fr: 'Mise à jour auto quotidienne', de: 'Tägliches Auto-Update', es: 'Actualización diaria automática', tr: 'Otomatik günlük güncelleme', ru: 'Автоматическое ежедневное обновление' },
  articles: { en: 'Articles', ar: 'مقالات', fr: 'Articles', de: 'Artikel', es: 'Artículos', tr: 'Makaleler', ru: 'Статьи' },
  automatedNews: { en: '📡 Automated Daily News', ar: '📡 أخبار يومية آلية', fr: '📡 Actualités quotidiennes automatiques', de: '📡 Automatische tägliche Nachrichten', es: '📡 Noticias diarias automatizadas', tr: '📡 Otomatik günlük haberler', ru: '📡 Автоматические ежедневные новости' },
  newsDesc: { en: 'News is automatically updated every day at 8 AM from trusted cybersecurity sources', ar: 'الأخبار تتحدّث تلقائياً كل يوم الساعة 8 صباحاً من مصادر أمن سيبراني موثوقة', fr: 'Actualités mises à jour automatiquement chaque jour à 8h depuis des sources fiables', de: 'Nachrichten werden täglich um 8 Uhr automatisch aktualisiert', es: 'Noticias actualizadas automáticamente cada día a las 8 AM', tr: 'Haberler güvenilir kaynaklardan her gün saat 8\'de otomatik güncellenir', ru: 'Новости обновляются ежедневно в 8:00 из надёжных источников' },
  lastUpdated: { en: 'Last Updated', ar: 'آخر تحديث', fr: 'Dernière mise à jour', de: 'Zuletzt aktualisiert', es: 'Última actualización', tr: 'Son güncelleme', ru: 'Последнее обновление' },
  backToArticles: { en: 'Back to Articles', ar: 'العودة للمقالات', fr: 'Retour aux articles', de: 'Zurück zu den Artikeln', es: 'Volver a los artículos', tr: 'Makalelere dön', ru: 'Назад к статьям' },
  dailyNews: { en: 'Daily News', ar: 'أخبار يومية', fr: 'Actualités', de: 'Tägliche Nachrichten', es: 'Noticias diarias', tr: 'Günlük haberler', ru: 'Ежедневные новости' },
  minRead: { en: 'min read', ar: 'دقائق قراءة', fr: 'min de lecture', de: 'Min. Lesezeit', es: 'min de lectura', tr: 'dk okuma', ru: 'мин чтения' },
  read: { en: 'Read', ar: 'اقرأ', fr: 'Lire', de: 'Lesen', es: 'Leer', tr: 'Oku', ru: 'Читать' },
  readMore: { en: 'Read More', ar: 'اقرأ المزيد', fr: 'Lire la suite', de: 'Weiterlesen', es: 'Leer más', tr: 'Devamını oku', ru: 'Читать далее' },
  readArticle: { en: 'Read Article', ar: 'اقرأ المقال', fr: 'Lire l\'article', de: 'Artikel lesen', es: 'Leer artículo', tr: 'Makaleyi oku', ru: 'Читать статью' },
  latestNews: { en: 'Latest News — Auto Updated', ar: 'آخر الأخبار — تحديث تلقائي', fr: 'Dernières nouvelles — Mise à jour auto', de: 'Neueste Nachrichten — Auto-Update', es: 'Últimas noticias — Actualización automática', tr: 'Son haberler — Otomatik güncelleme', ru: 'Последние новости — Автообновление' },
  breakingNews: { en: 'Breaking News', ar: 'أخبار عاجلة', fr: 'Dernière minute', de: 'Eilmeldung', es: 'Noticias de última hora', tr: 'Son dakika', ru: 'Срочные новости' },
  breaking: { en: 'BREAKING', ar: 'عاجل', fr: 'URGENT', de: 'EILMELDUNG', es: 'URGENTE', tr: 'SON DAKİKA', ru: 'СРОЧНО' },
  searchArticles: { en: 'Search articles...', ar: 'ابحث في المقالات...', fr: 'Rechercher des articles...', de: 'Artikel suchen...', es: 'Buscar artículos...', tr: 'Makale ara...', ru: 'Поиск статей...' },
  featured: { en: 'Featured', ar: 'مميّز', fr: 'En vedette', de: 'Empfohlen', es: 'Destacado', tr: 'Öne çıkan', ru: 'Рекомендуемое' },
  noResults: { en: 'No articles match your search', ar: 'لا توجد مقالات تطابق بحثك', fr: 'Aucun article ne correspond', de: 'Keine passenden Artikel', es: 'No hay artículos que coincidan', tr: 'Aramanızla eşleşen makale yok', ru: 'Статьи не найдены' },
  published: { en: 'Published', ar: 'منشور', fr: 'Publié', de: 'Veröffentlicht', es: 'Publicado', tr: 'Yayınlandı', ru: 'Опубликовано' },
  categories: { en: 'Categories', ar: 'تصنيفات', fr: 'Catégories', de: 'Kategorien', es: 'Categorías', tr: 'Kategoriler', ru: 'Категории' },
  cybersecurity: { en: 'Cybersecurity', ar: 'أمن سيبراني', fr: 'Cybersécurité', de: 'Cybersicherheit', es: 'Ciberseguridad', tr: 'Siber güvenlik', ru: 'Кибербезопасность' },
  loadingNews: { en: 'Loading latest news...', ar: 'جاري تحميل آخر الأخبار...', fr: 'Chargement des dernières actualités...', de: 'Lade aktuelle Nachrichten...', es: 'Cargando últimas noticias...', tr: 'Son haberler yükleniyor...', ru: 'Загрузка свежих новостей...' },
  newsLoadError: { en: 'Daily news could not be loaded at this time.', ar: 'تعذر تحميل الأخبار اليومية في الوقت الحالي.', fr: 'Les actualités quotidiennes n\'ont pas pu être chargées pour le moment.', de: 'Tägliche Nachrichten konnten derzeit nicht geladen werden.', es: 'No se pudieron cargar las noticias diarias en este momento.', tr: 'Günlük haberler şu anda yüklenemedi.', ru: 'Не удалось загрузить ежедневные новости.' },
};

const t = (key: string, lang: string) => blogT[key]?.[lang] || blogT[key]?.en || key;

// RTL languages
const RTL_LANGS = new Set(['ar']);

// Helper: get translated news field with fallback to English
function getNewsField(news: any, field: 'title' | 'summary' | 'content', lang: string): string {
  if (lang === 'en') return news[field] || '';
  if (news.translations && news.translations[lang] && news.translations[lang][field]) {
    return news.translations[lang][field];
  }
  return news[field] || '';
}

export default function Blog() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const isRtl = RTL_LANGS.has(lang);
  // Determine if news content should be shown as LTR (i.e. no translation available, or language is LTR)
  const newsContentDir = (news: any) => {
    if (lang === 'en') return 'ltr';
    // If we have a translation for this language, use its direction
    if (news.translations && news.translations[lang] && news.translations[lang].title) {
      return isRtl ? 'rtl' : 'ltr';
    }
    return 'ltr'; // Fallback: English content = LTR
  };
  const newsTextAlign = (news: any) => {
    const dir = newsContentDir(news);
    return dir === 'rtl' ? 'text-right' : 'text-left';
  };
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedNews, setSelectedNews] = useState<DailyNewsItem | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [dailyNewsPayload, setDailyNewsPayload] = useState<{ lastUpdated?: string; articles?: DailyNewsItem[] } | null>(null);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [newsLoadError, setNewsLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/data/dailyNews.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (active) {
          setDailyNewsPayload(data);
          setIsLoadingNews(false);
        }
      })
      .catch(err => {
        console.warn('Failed to load daily news:', err);
        if (active) {
          setNewsLoadError(true);
          setIsLoadingNews(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const scrollToTop = () => {
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openArticle = (article: Article | null) => {
    setSelectedArticle(article);
    if (article) setTimeout(scrollToTop, 50);
  };
  const openNews = (news: DailyNewsItem | null) => {
    setSelectedNews(news);
    if (news) setTimeout(scrollToTop, 50);
  };
  const [searchQuery, setSearchQuery] = useState('');

  // Helper to get localized article fields
  const getTitle = (a: Article) => isAr ? a.titleAr : a.title;
  const getSummary = (a: Article) => isAr ? a.summaryAr : a.summary;
  const getContent = (a: Article) => isAr ? a.contentAr : a.content;
  const getCategory = (a: Article) => isAr ? a.categoryAr : a.category;
  const getReadTime = (a: Article) => isAr ? a.readTimeAr : a.readTime;
  const getTags = (a: Article) => isAr ? a.tagsAr : a.tags;
  const getCategoryLabel = (idx: number) => isAr ? CATEGORIES_AR[idx] : CATEGORIES[idx];
  const dateLocale = { en: 'en-US', ar: 'ar-EG', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', tr: 'tr-TR', ru: 'ru-RU' }[lang] || 'en-US';

  const filteredArticles = useMemo(() => {
    let articles = ARTICLES;
    if (activeCategory !== 'All') {
      articles = articles.filter(a => a.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      articles = articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.titleAr.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.summaryAr.toLowerCase().includes(q) ||
        a.tags.some(tg => tg.toLowerCase().includes(q)) ||
        a.tagsAr.some(tg => tg.includes(q))
      );
    }
    return articles;
  }, [activeCategory, searchQuery]);

  const featured = ARTICLES.find(a => a.featured);
  const newsArticles = ARTICLES.filter(a => a.isNews).slice(0, 4);
  const regularArticles = filteredArticles;

  // Sort daily news by date descending (newest first) and only keep last 14 days
  const sortedDailyNews = useMemo(() => {
    if (!dailyNewsPayload?.articles || !dailyNewsPayload.articles.length) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    return [...dailyNewsPayload.articles]
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter((a: any) => new Date(a.date) >= cutoff);
  }, [dailyNewsPayload]);

  const totalArticleCount = ARTICLES.length + sortedDailyNews.length;

  return (
    <div className="focus-blog" dir={isAr ? 'rtl' : 'ltr'}>
      {!selectedArticle && !selectedNews && <header className="fb-hero">
        <div><span className="fb-eyebrow">JOESCAN / JOURNAL</span><h1>{isAr ? 'افهم أكتر.' : 'Stay curious.'}<br/><em>{isAr ? 'احمي عالمك الرقمي.' : 'Stay a step ahead.'}</em></h1><p>{t('subtitle', lang)}</p></div>
        <div className="fb-hero-note"><BookOpen size={30}/><span>{isAr ? 'معرفة تستحق وقتك' : 'A clearer view of digital security'}</span><p>{isAr ? 'أدلة عملية وأخبار تساعدك تفهم المخاطر وتاخد الخطوة المناسبة.' : 'Practical guides, fresh perspectives, and the context behind the headlines.'}</p><a href="#journal-library">{isAr ? 'استكشف المقالات' : 'Explore the journal'} ↓</a></div>
      </header>}

      <AnimatePresence mode="wait">
        {selectedNews ? (
          /* Daily News Article View - Full Content */
          <motion.div
            key="news-article"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fb-reader space-y-6"
          >
            <button
              onClick={() => setSelectedNews(null)}
              className="flex items-center gap-2 text-sm text-accent hover:underline font-bold"
            >
              <ArrowRight className={`w-4 h-4 ${isAr ? '' : 'rotate-180'}`} />
              {t('backToArticles', lang)}
            </button>

            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-cyan-500/30 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> {t('dailyNews', lang)}
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/30">
                    {selectedNews.source}
                  </span>
                  <span className="text-[10px] text-text-dim font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(selectedNews.date).toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className="text-[10px] text-text-dim font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {Math.max(2, Math.ceil(((selectedNews as any).content || '').length / 500))} {t('minRead', lang)}
                  </span>
                </div>
                <h1 dir={newsContentDir(selectedNews)} className={`text-2xl font-black text-text-main leading-relaxed ${newsTextAlign(selectedNews)}`}>{getNewsField(selectedNews, 'title', lang).replace(/ - .*$/, '')}</h1>
              </div>

              {/* Full Article Content — direction depends on translation availability */}
              <div dir={newsContentDir(selectedNews)} className={`prose prose-invert max-w-none ${newsTextAlign(selectedNews)}`}>
                {(getNewsField(selectedNews, 'content', lang) || getNewsField(selectedNews, 'title', lang).replace(/ - .*$/, '')).split('\n').map((line: string, i: number) => {
                  if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-text-main mt-8 mb-4 border-b border-border-subtle pb-2">{line.replace('## ', '')}</h2>;
                  if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-accent mt-6 mb-3">{line.replace('### ', '')}</h3>;
                  if (line.startsWith('- ')) return <li key={i} className="text-sm text-text-dim ml-4 mb-1 list-disc leading-relaxed">{line.replace('- ', '')}</li>;
                  if (line.startsWith('---')) return <hr key={i} className="border-border-subtle my-6" />;
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i} className="text-sm text-text-dim leading-relaxed mb-3">{line}</p>;
                })}
              </div>

              {/^https?:\/\//i.test(selectedNews.link) && <a className="fb-source" href={selectedNews.link} target="_blank" rel="noopener noreferrer">{isAr ? 'اقرأ المصدر الأصلي' : 'Read original source'} <ExternalLink size={16}/></a>}
              {/* Tags */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border-subtle">
                <span className="flex items-center gap-1 px-2 py-1 bg-bg-base border border-border-subtle rounded-lg text-[10px] text-text-dim font-mono">
                  <Tag className="w-3 h-3" /> {t('cybersecurity', lang)}
                </span>
                <span className="flex items-center gap-1 px-2 py-1 bg-bg-base border border-border-subtle rounded-lg text-[10px] text-text-dim font-mono">
                  <Tag className="w-3 h-3" /> {t('dailyNews', lang)}
                </span>
                <span className="flex items-center gap-1 px-2 py-1 bg-bg-base border border-border-subtle rounded-lg text-[10px] text-text-dim font-mono">
                  <Tag className="w-3 h-3" /> {selectedNews.source}
                </span>
              </div>
            </div>
          </motion.div>
        ) : selectedArticle ? (
          /* Full Article View */
          <motion.div
            key="article"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fb-reader space-y-6"
          >
            <button
              onClick={() => setSelectedArticle(null)}
              className="flex items-center gap-2 text-sm text-accent hover:underline font-bold"
            >
              <ArrowRight className={`w-4 h-4 ${isAr ? '' : 'rotate-180'}`} />
              {t('backToArticles', lang)}
            </button>

            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  
                  <span className="px-3 py-1 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest rounded-lg border border-accent/20">
                    {getCategory(selectedArticle)}
                  </span>
                  <span className="text-[10px] text-text-dim font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(selectedArticle.date).toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className="text-[10px] text-text-dim font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {getReadTime(selectedArticle)} {isAr ? '' : 'read'}
                  </span>
                </div>
                <h1 className="text-2xl font-black text-text-main leading-relaxed">{getTitle(selectedArticle)}</h1>
              </div>

              {/* Article Content */}
              <div className="prose prose-invert max-w-none">
                {getContent(selectedArticle).split('\n').map((line, i) => {
                  if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-text-main mt-8 mb-4 border-b border-border-subtle pb-2">{line.replace('## ', '')}</h2>;
                  if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-accent mt-6 mb-3">{line.replace('### ', '')}</h3>;
                  if (line.startsWith('#### ')) return <h4 key={i} className="text-base font-bold text-text-main mt-4 mb-2">{line.replace('#### ', '')}</h4>;
                  if (line.startsWith('- ')) return <li key={i} className="text-sm text-text-dim ml-4 mb-1 list-disc leading-relaxed">{line.replace('- ', '')}</li>;
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
                {getTags(selectedArticle).map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-bg-base border border-border-subtle rounded-lg text-[10px] text-text-dim font-mono">
                    <Tag className="w-3 h-3" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="fb-list">
            {featured && <button className="fb-featured" onClick={() => openArticle(featured)}>
              <div className="fb-feature-art" aria-hidden="true"><div className="fb-orbit"/><Shield size={80}/><span>JOESCAN INSIGHTS / 01</span></div>
              <div className="fb-feature-copy"><span className="fb-eyebrow">{t('featured',lang)} / {getCategory(featured)}</span><h2>{getTitle(featured)}</h2><p>{getSummary(featured)}</p><span className="fb-feature-foot">{getReadTime(featured)} <b>{t('readArticle',lang)} ↗</b></span></div>
            </button>}
            <section className="fb-library" id="journal-library">
              <div className="fb-section-title"><div><span className="fb-eyebrow">02 / {isAr ? 'المكتبة' : 'THE LIBRARY'}</span><h2>{isAr ? 'معرفة لحياتك الرقمية' : 'Worth a closer look.'}</h2></div><label className="fb-search"><Search size={18}/><input aria-label={t('searchArticles',lang)} placeholder={t('searchArticles',lang)} value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/></label></div>
              <div className="fb-categories">{CATEGORIES.map((cat,idx)=><button key={cat} aria-pressed={activeCategory===cat} onClick={()=>setActiveCategory(cat)}>{getCategoryLabel(idx)}</button>)}</div>
              <p className="fb-results" aria-live="polite">{regularArticles.length} {t('articles',lang)}</p>
              <div className="fb-grid">{regularArticles.map((article,idx)=>{const Icon=CATEGORY_ICONS[article.category]||Shield;return <button key={article.id} className="fb-card" onClick={()=>openArticle(article)}><div className="fb-card-art" data-variant={idx%3} aria-hidden="true"><Icon size={38}/><span>{String(idx+1).padStart(2,'0')}</span></div><div className="fb-card-copy"><span className="fb-eyebrow">{getCategory(article)}</span><h3>{getTitle(article)}</h3><p>{getSummary(article)}</p><footer><span>{new Date(article.date).toLocaleDateString(dateLocale,{month:'short',day:'numeric',year:'numeric'})} · {getReadTime(article)}</span><ArrowRight size={18}/></footer></div></button>})}</div>
              {!regularArticles.length && <div className="fb-empty"><Search size={30}/><p>{t('noResults',lang)}</p><button onClick={()=>{setSearchQuery('');setActiveCategory('All')}}>{isAr?'عرض كل المقالات':'Show all articles'}</button></div>}
            </section>
            <section className="fb-news"><div className="fb-section-title"><div><span className="fb-eyebrow">03 / {isAr?'الأخبار':'NEWS DESK'}</span><h2>{t('dailyNews',lang)}</h2></div><span className="fb-results">{t('lastUpdated',lang)}: {dailyNewsPayload?.lastUpdated ? new Date(dailyNewsPayload.lastUpdated).toLocaleDateString(dateLocale) : '—'}</span></div>
              {isLoadingNews ? <p role="status">{t('loadingNews',lang)}</p> : newsLoadError ? <p role="status">{t('newsLoadError',lang)}</p> : !sortedDailyNews.length ? <p>{isAr?'لا توجد أخبار حديثة متاحة الآن.':'No recent news is available right now.'}</p> : <div className="fb-news-grid">{sortedDailyNews.map((news,idx)=><button key={news.link+idx} onClick={()=>openNews(news)} className="fb-news-item" dir={newsContentDir(news)}><span className="fb-eyebrow">{news.source} · {new Date(news.date).toLocaleDateString(dateLocale,{month:'short',day:'numeric'})}</span><h3>{getNewsField(news,'title',lang)}</h3><p>{getNewsField(news,'summary',lang)}</p><span>{t('readMore',lang)} ↗</span></button>)}</div>}
            </section>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
