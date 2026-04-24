import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Calendar, Clock, ChevronRight, ArrowRight, Tag, TrendingUp, Shield, AlertTriangle, Eye, Lock, Wifi, X, Zap, Newspaper, Filter, Search, Smartphone, Brain, Baby, Bitcoin, CreditCard, Globe, ExternalLink, Radio, RefreshCw, Link2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ARTICLES, CATEGORIES, type Article } from '../data/blogArticles';
import dailyNewsData from '../data/dailyNews.json';

interface DailyNewsItem {
  title: string;
  link: string;
  date: string;
  source: string;
  summary: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  'تسريبات': AlertTriangle,
  'كلمات المرور': Lock,
  'التصيد': Eye,
  'شبكات': Wifi,
  'خصوصية': Shield,
  'أخبار عاجلة': Zap,
  'تقارير': Brain,
  'نصائح': Smartphone,
};

export default function Blog() {
  const { lang } = useLanguage();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedNews, setSelectedNews] = useState<DailyNewsItem | null>(null);
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredArticles = useMemo(() => {
    let articles = ARTICLES;
    if (activeCategory !== 'الكل') {
      articles = articles.filter(a => a.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      articles = articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return articles;
  }, [activeCategory, searchQuery]);

  const featured = ARTICLES.find(a => a.featured);
  const newsArticles = ARTICLES.filter(a => a.isNews).slice(0, 4);
  const regularArticles = filteredArticles.filter(a => !a.featured || activeCategory !== 'الكل');

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-widest text-text-main">مدوّنة الأمن السيبراني</h1>
            <p className="text-xs text-text-dim font-mono">مقالات وأخبار لحمايتك الرقمية — بالعربي</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: '3s' }} />
            <span className="text-[10px] font-bold text-emerald-400">تحديث يومي تلقائي</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-xl">
            <Newspaper className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-accent">{ARTICLES.length} مقال</span>
          </div>
        </div>
      </div>

      {/* Auto-Update Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-accent/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center shrink-0">
          <Radio className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-text-main">📡 أخبار يومية تلقائية</h3>
          <p className="text-[11px] text-text-dim mt-0.5">يتم تحديث الأخبار تلقائياً كل يوم الساعة 8 صباحاً من مصادر إخبارية عربية موثوقة</p>
        </div>
        <div className="text-left shrink-0">
          <div className="text-[10px] text-text-dim font-mono">آخر تحديث</div>
          <div className="text-xs font-bold text-emerald-400">{dailyNewsData.lastUpdated ? new Date(dailyNewsData.lastUpdated).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedNews ? (
          /* Daily News Article View */
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
              <ArrowRight className="w-4 h-4" />
              العودة للمقالات
            </button>

            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-cyan-500/30 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> خبر يومي تلقائي
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/30">
                    {selectedNews.source}
                  </span>
                  <span className="text-[10px] text-text-dim font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(selectedNews.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <h1 className="text-2xl font-black text-text-main leading-relaxed">{selectedNews.title.replace(/ - .*$/, '')}</h1>
              </div>

              {/* News Content */}
              <div className="prose prose-invert max-w-none space-y-4">
                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4">
                  <p className="text-sm text-text-dim leading-relaxed">
                    هذا الخبر تم جلبه تلقائياً من مصادر إخبارية عربية موثوقة عبر نظام التحديث اليومي التلقائي لمنصة JoeScan.
                  </p>
                </div>

                <h2 className="text-xl font-bold text-text-main mt-6 mb-4 border-b border-border-subtle pb-2">ملخص الخبر</h2>
                <p className="text-sm text-text-dim leading-relaxed mb-2">
                  {selectedNews.title.replace(/ - .*$/, '')}
                </p>
                <p className="text-sm text-text-dim leading-relaxed mb-2">
                  تم نشر هذا الخبر عبر <span className="text-cyan-400 font-bold">{selectedNews.source}</span> بتاريخ {new Date(selectedNews.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}.
                </p>

                <h2 className="text-xl font-bold text-text-main mt-8 mb-4 border-b border-border-subtle pb-2">لماذا هذا الخبر مهم؟</h2>
                <p className="text-sm text-text-dim leading-relaxed mb-2">
                  يُعد هذا الخبر جزءاً من التطورات الأمنية السيبرانية المهمة التي يجب على كل مستخدم عربي متابعتها. نحرص في JoeScan على تقديم أحدث الأخبار الأمنية لمساعدتك في حماية بياناتك الرقمية.
                </p>

                <div className="bg-gradient-to-r from-accent/5 via-purple-500/5 to-cyan-500/5 border border-accent/20 rounded-xl p-5 mt-6">
                  <h3 className="text-base font-bold text-accent mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    نصائح أمنية عامة
                  </h3>
                  <ul className="space-y-2">
                    <li className="text-sm text-text-dim leading-relaxed flex items-start gap-2">
                      <span className="text-accent mt-1">•</span>
                      تأكد دائماً من تحديث أنظمة التشغيل والتطبيقات لديك لأحدث إصدار
                    </li>
                    <li className="text-sm text-text-dim leading-relaxed flex items-start gap-2">
                      <span className="text-accent mt-1">•</span>
                      استخدم كلمات مرور قوية وفريدة لكل حساب مع تفعيل المصادقة الثنائية
                    </li>
                    <li className="text-sm text-text-dim leading-relaxed flex items-start gap-2">
                      <span className="text-accent mt-1">•</span>
                      تابع آخر الأخبار الأمنية لتبقى على دراية بأحدث التهديدات والثغرات
                    </li>
                  </ul>
                </div>
              </div>

              {/* Source Link */}
              <div className="flex flex-col gap-3 pt-4 border-t border-border-subtle">
                <a
                  href={selectedNews.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 text-sm font-bold hover:bg-cyan-500/20 transition-all"
                >
                  <Link2 className="w-4 h-4" />
                  قراءة الخبر من المصدر الأصلي — {selectedNews.source}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <div className="flex flex-wrap gap-2">
                  <span className="flex items-center gap-1 px-2 py-1 bg-bg-base border border-border-subtle rounded-lg text-[10px] text-text-dim font-mono">
                    <Tag className="w-3 h-3" /> أمن سيبراني
                  </span>
                  <span className="flex items-center gap-1 px-2 py-1 bg-bg-base border border-border-subtle rounded-lg text-[10px] text-text-dim font-mono">
                    <Tag className="w-3 h-3" /> أخبار يومية
                  </span>
                  <span className="flex items-center gap-1 px-2 py-1 bg-bg-base border border-border-subtle rounded-lg text-[10px] text-text-dim font-mono">
                    <Tag className="w-3 h-3" /> {selectedNews.source}
                  </span>
                </div>
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
              <ArrowRight className="w-4 h-4" />
              العودة للمقالات
            </button>

            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {selectedArticle.isNews && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-red-500/30 flex items-center gap-1 animate-pulse">
                      <Zap className="w-3 h-3" /> عاجل
                    </span>
                  )}
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
            {/* Daily Auto-Fetched News */}
            {dailyNewsData.articles && dailyNewsData.articles.length > 0 && (
              <div className="bg-gradient-to-br from-cyan-500/5 via-bg-surface to-emerald-500/5 border border-cyan-500/20 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 bg-cyan-500/20 rounded-lg flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">آخر الأخبار — تحديث تلقائي</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-dim font-mono">{dailyNewsData.articles.length} خبر</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {dailyNewsData.articles.slice(0, 10).map((news: any, idx: number) => (
                    <motion.div
                      key={idx}
                      onClick={() => setSelectedNews(news as DailyNewsItem)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ scale: 1.005 }}
                      className="flex items-start gap-3 p-3 bg-bg-surface/50 border border-border-subtle rounded-xl cursor-pointer hover:border-cyan-500/30 transition-all group"
                    >
                      <div className="w-2 h-2 bg-cyan-400 rounded-full mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-text-main leading-relaxed line-clamp-2 group-hover:text-cyan-400 transition-colors">{news.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-cyan-400/80 font-mono">{news.source}</span>
                          <span className="text-[10px] text-text-dim font-mono">• {new Date(news.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-text-dim group-hover:text-cyan-400 shrink-0 mt-1 transition-colors font-bold">
                        اقرأ <ChevronRight className="w-3 h-3 rotate-180" />
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
                    <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">مقالات عاجلة</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {newsArticles.map(article => (
                    <motion.div
                      key={article.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedArticle(article)}
                      className="flex items-start gap-3 p-3 bg-bg-surface/50 border border-red-500/10 rounded-xl cursor-pointer hover:border-red-500/30 transition-all group"
                    >
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0 animate-pulse" />
                      <div>
                        <h4 className="text-xs font-bold text-text-main leading-relaxed line-clamp-2">{article.title}</h4>
                        <span className="text-[10px] text-text-dim font-mono mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {article.readTime}
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
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث في المقالات..."
                  className="w-full pr-10 pl-4 py-2.5 bg-bg-surface border border-border-subtle rounded-xl text-sm text-text-main placeholder-text-dim focus:outline-none focus:border-accent/40"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    activeCategory === cat
                      ? 'bg-accent/20 text-accent border-accent/30'
                      : 'bg-bg-surface text-text-dim border-border-subtle hover:border-accent/20'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Featured Article */}
            {activeCategory === 'الكل' && !searchQuery && featured && (
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
                    onClick={() => setSelectedArticle(article)}
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
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-bold rounded animate-pulse">عاجل</span>
                          )}
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

            {/* No Results */}
            {regularArticles.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-text-dim/30 mx-auto mb-3" />
                <p className="text-sm text-text-dim">لا توجد مقالات تطابق البحث</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-bg-surface border border-border-subtle rounded-xl p-3 text-center">
                <div className="text-lg font-black text-accent">{ARTICLES.length}</div>
                <div className="text-[10px] text-text-dim font-mono">مقال منشور</div>
              </div>
              <div className="bg-bg-surface border border-border-subtle rounded-xl p-3 text-center">
                <div className="text-lg font-black text-red-400">{ARTICLES.filter(a => a.isNews).length}</div>
                <div className="text-[10px] text-text-dim font-mono">خبر عاجل</div>
              </div>
              <div className="bg-bg-surface border border-border-subtle rounded-xl p-3 text-center">
                <div className="text-lg font-black text-purple-400">{CATEGORIES.length - 1}</div>
                <div className="text-[10px] text-text-dim font-mono">تصنيف</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
