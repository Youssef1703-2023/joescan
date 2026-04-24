import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Calendar, Clock, ChevronRight, ArrowRight, Tag, TrendingUp, Shield, AlertTriangle, Eye, Lock, Wifi, X, Zap, Newspaper, Filter, Search, Smartphone, Brain, Baby, Bitcoin, CreditCard, Globe, ExternalLink, Radio, RefreshCw, Link2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ARTICLES, CATEGORIES, CATEGORIES_AR, type Article } from '../data/blogArticles';
import dailyNewsData from '../data/dailyNews.json';

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
  const regularArticles = filteredArticles.filter(a => !a.featured || activeCategory !== 'All');

  // Sort daily news by date descending (newest first) and only keep last 14 days
  const sortedDailyNews = useMemo(() => {
    if (!dailyNewsData.articles || !dailyNewsData.articles.length) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    return [...dailyNewsData.articles]
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter((a: any) => new Date(a.date) >= cutoff);
  }, []);

  const totalArticleCount = ARTICLES.length + sortedDailyNews.length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-widest text-text-main">{t('header', lang)}</h1>
            <p className="text-xs text-text-dim font-mono">{t('subtitle', lang)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: '3s' }} />
            <span className="text-[10px] font-bold text-emerald-400">{t('autoDaily', lang)}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-xl">
            <Newspaper className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-accent">{totalArticleCount} {t('articles', lang)}</span>
          </div>
        </div>
      </div>

      {/* Auto-Update Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-accent/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center shrink-0">
          <Radio className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-text-main">{t('automatedNews', lang)}</h3>
          <p className="text-[11px] text-text-dim mt-0.5">{t('newsDesc', lang)}</p>
        </div>
        <div className={`text-${isAr ? 'left' : 'right'} shrink-0`}>
          <div className="text-[10px] text-text-dim font-mono">{t('lastUpdated', lang)}</div>
          <div className="text-xs font-bold text-emerald-400">{dailyNewsData.lastUpdated ? new Date(dailyNewsData.lastUpdated).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedNews ? (
          /* Daily News Article View - Full Content */
          <motion.div
            key="news-article"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
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
            className="space-y-6"
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
                  {selectedArticle.isNews && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-red-500/30 flex items-center gap-1 animate-pulse">
                      <Zap className="w-3 h-3" /> {t('breaking', lang)}
                    </span>
                  )}
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
          /* Article List */
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Daily Auto-Fetched News */}
            {sortedDailyNews.length > 0 && (
              <div className="bg-gradient-to-br from-cyan-500/5 via-bg-surface to-emerald-500/5 border border-cyan-500/20 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 bg-cyan-500/20 rounded-lg flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">{t('latestNews', lang)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-dim font-mono">{sortedDailyNews.length} {t('articles', lang)}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {sortedDailyNews.slice(0, 10).map((news: any, idx: number) => (
                    <motion.div
                      key={idx}
                      onClick={() => openNews(news as DailyNewsItem)}
                      initial={{ opacity: 0, x: isAr ? 10 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ scale: 1.005 }}
                      className="flex items-start gap-3 p-3 bg-bg-surface/50 border border-border-subtle rounded-xl cursor-pointer hover:border-cyan-500/30 transition-all group"
                    >
                      <div className="w-2 h-2 bg-cyan-400 rounded-full mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0" dir={newsContentDir(news)}>
                        <h4 className={`text-xs font-bold text-text-main leading-relaxed line-clamp-2 group-hover:text-cyan-400 transition-colors ${newsTextAlign(news)}`}>{getNewsField(news, 'title', lang)}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-cyan-400/80 font-mono">{news.source}</span>
                          <span className="text-[10px] text-text-dim font-mono">• {new Date(news.date).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-text-dim group-hover:text-cyan-400 shrink-0 mt-1 transition-colors font-bold">
                        {t('read', lang)} <ChevronRight className="w-3 h-3" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Breaking News Ticker */}
            {newsArticles.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="px-2.5 py-1 bg-red-500/20 rounded-lg flex items-center gap-1.5 animate-pulse">
                    <Zap className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">{t('breakingNews', lang)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {newsArticles.map(article => (
                    <motion.div
                      key={article.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => openArticle(article)}
                      className="flex items-start gap-3 p-3 bg-bg-surface/50 border border-red-500/10 rounded-xl cursor-pointer hover:border-red-500/30 transition-all group"
                    >
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0 animate-pulse" />
                      <div>
                        <h4 className="text-xs font-bold text-text-main leading-relaxed line-clamp-2">{getTitle(article)}</h4>
                        <span className="text-[10px] text-text-dim font-mono mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {getReadTime(article)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('searchArticles', lang)}
                  className={`w-full ${isAr ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 bg-bg-surface border border-border-subtle rounded-xl text-sm text-text-main placeholder-text-dim focus:outline-none focus:border-accent/40`}
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat, idx) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    activeCategory === cat
                      ? 'bg-accent/20 text-accent border-accent/30'
                      : 'bg-bg-surface text-text-dim border-border-subtle hover:border-accent/20'
                  }`}
                >
                  {getCategoryLabel(idx)}
                </button>
              ))}
            </div>

            {/* Featured Article */}
            {activeCategory === 'All' && !searchQuery && featured && (
              <motion.div
                whileHover={{ scale: 1.005 }}
                onClick={() => openArticle(featured)}
                className="bg-gradient-to-br from-accent/10 via-bg-surface to-purple-500/5 border border-accent/20 rounded-2xl p-6 cursor-pointer hover:border-accent/40 transition-all relative overflow-hidden group"
              >
                <div className={`absolute top-3 ${isAr ? 'right-3' : 'left-3'} px-2 py-0.5 bg-accent/20 text-accent text-[10px] font-bold uppercase tracking-widest rounded-lg border border-accent/30 flex items-center gap-1`}>
                  <TrendingUp className="w-3 h-3" /> {t('featured', lang)}
                </div>
                <div className="space-y-3 mt-6">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 bg-bg-base border border-border-subtle rounded-lg text-[10px] text-text-dim font-mono">
                      {getCategory(featured)}
                    </span>
                    <span className="text-[10px] text-text-dim font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(featured.date).toLocaleDateString(dateLocale, { month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-text-main leading-relaxed">{getTitle(featured)}</h2>
                  <p className="text-sm text-text-dim leading-relaxed">{getSummary(featured)}</p>
                  <div className="flex items-center gap-2 text-accent text-xs font-bold pt-2">
                    {t('readArticle', lang)} <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Articles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regularArticles.map((article, idx) => {
                const CatIcon = CATEGORY_ICONS[article.category] || Shield;
                return (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => openArticle(article)}
                    className={`bg-bg-surface border rounded-2xl p-5 cursor-pointer transition-all group ${
                      article.isNews ? 'border-red-500/20 hover:border-red-500/40' : 'border-border-subtle hover:border-accent/30'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 border rounded-xl flex items-center justify-center shrink-0 mt-1 ${
                        article.isNews ? 'bg-red-500/10 border-red-500/20' : 'bg-accent/10 border-accent/20'
                      }`}>
                        <CatIcon className={`w-5 h-5 ${article.isNews ? 'text-red-400' : 'text-accent'}`} />
                      </div>
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {article.isNews && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-bold rounded animate-pulse">{t('breaking', lang)}</span>
                          )}
                          <span className="text-[10px] text-text-dim font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(article.date).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-[10px] text-text-dim font-mono">• {getReadTime(article)}</span>
                        </div>
                        <h3 className="font-bold text-sm text-text-main leading-relaxed line-clamp-2">{getTitle(article)}</h3>
                        <p className="text-xs text-text-dim leading-relaxed line-clamp-2">{getSummary(article)}</p>
                        <div className="flex items-center gap-1 text-accent text-[10px] font-bold pt-1">
                          {t('readMore', lang)} <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* No Results */}
            {regularArticles.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-text-dim/30 mx-auto mb-3" />
                <p className="text-sm text-text-dim">{t('noResults', lang)}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-bg-surface border border-border-subtle rounded-xl p-3 text-center">
                <div className="text-lg font-black text-accent">{ARTICLES.length}</div>
                <div className="text-[10px] text-text-dim font-mono">{t('published', lang)}</div>
              </div>
              <div className="bg-bg-surface border border-border-subtle rounded-xl p-3 text-center">
                <div className="text-lg font-black text-red-400">{ARTICLES.filter(a => a.isNews).length}</div>
                <div className="text-[10px] text-text-dim font-mono">{t('breaking', lang)}</div>
              </div>
              <div className="bg-bg-surface border border-border-subtle rounded-xl p-3 text-center">
                <div className="text-lg font-black text-purple-400">{CATEGORIES.length - 1}</div>
                <div className="text-[10px] text-text-dim font-mono">{t('categories', lang)}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
