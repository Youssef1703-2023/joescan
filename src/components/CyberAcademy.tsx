import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Shield, Mail, KeyRound, Wifi, Eye, Smartphone, Globe, Lock, Search, Play, ChevronRight, BookOpen, Clock, Star, Filter } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Lesson {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  level: 'مبتدئ' | 'متوسط' | 'متقدم';
  youtubeId: string;
  thumbnail: string;
}

const CATEGORIES = [
  { id: 'all', label: 'الكل', icon: BookOpen },
  { id: 'email', label: 'حماية الإيميل', icon: Mail },
  { id: 'passwords', label: 'كلمات المرور', icon: KeyRound },
  { id: 'phishing', label: 'التصيد الاحتيالي', icon: Eye },
  { id: 'network', label: 'أمن الشبكات', icon: Wifi },
  { id: 'privacy', label: 'الخصوصية', icon: Lock },
  { id: 'mobile', label: 'أمن الموبايل', icon: Smartphone },
];

const LESSONS: Lesson[] = [
  {
    id: '1',
    title: 'أساسيات الأمن السيبراني — من أين تبدأ؟',
    description: 'تعلم المفاهيم الأساسية في الأمن السيبراني وكيف تحمي نفسك من التهديدات الرقمية اليومية. هذا الدرس يغطي أهم المصطلحات والممارسات الأمنية.',
    category: 'privacy',
    duration: '15 دقيقة',
    level: 'مبتدئ',
    youtubeId: 'inWWhr5tnEA',
    thumbnail: 'https://img.youtube.com/vi/inWWhr5tnEA/maxresdefault.jpg',
  },
  {
    id: '2',
    title: 'كيف تحمي إيميلك من الاختراق؟',
    description: 'دليل شامل لحماية بريدك الإلكتروني من محاولات الاختراق والتصيد. تعلم كيف تفعّل المصادقة الثنائية وتكتشف الرسائل المشبوهة.',
    category: 'email',
    duration: '12 دقيقة',
    level: 'مبتدئ',
    youtubeId: 'XLGYsU4e1cE',
    thumbnail: 'https://img.youtube.com/vi/XLGYsU4e1cE/maxresdefault.jpg',
  },
  {
    id: '3',
    title: 'إنشاء كلمات مرور قوية وغير قابلة للكسر',
    description: 'تعرف على أفضل الممارسات لإنشاء كلمات مرور آمنة واستخدام مدير كلمات المرور. لماذا كلمة المرور "123456" خطيرة جداً؟',
    category: 'passwords',
    duration: '10 دقائق',
    level: 'مبتدئ',
    youtubeId: '7U-RbOKanYs',
    thumbnail: 'https://img.youtube.com/vi/7U-RbOKanYs/maxresdefault.jpg',
  },
  {
    id: '4',
    title: 'كشف رسائل التصيد الاحتيالي (Phishing)',
    description: 'تعلم كيف تميز بين الرسائل الحقيقية ورسائل التصيد. أمثلة عملية وخطوات للحماية من أشهر أساليب الاحتيال الإلكتروني.',
    category: 'phishing',
    duration: '14 دقيقة',
    level: 'متوسط',
    youtubeId: 'XBkzBrXlle0',
    thumbnail: 'https://img.youtube.com/vi/XBkzBrXlle0/maxresdefault.jpg',
  },
  {
    id: '5',
    title: 'حماية شبكة الواي فاي المنزلية',
    description: 'خطوات عملية لتأمين شبكة الواي فاي في بيتك من المتطفلين والمخترقين. تغيير الإعدادات الافتراضية وتشفير الشبكة.',
    category: 'network',
    duration: '11 دقيقة',
    level: 'متوسط',
    youtubeId: 'hNlFDfaxPMM',
    thumbnail: 'https://img.youtube.com/vi/hNlFDfaxPMM/maxresdefault.jpg',
  },
  {
    id: '6',
    title: 'أمان الموبايل — حماية هاتفك الذكي',
    description: 'كيف تحمي موبايلك من الفيروسات والتطبيقات الضارة. إعدادات الأمان المهمة اللي لازم تفعلها دلوقتي.',
    category: 'mobile',
    duration: '13 دقيقة',
    level: 'مبتدئ',
    youtubeId: 'GFhSsJk-6mY',
    thumbnail: 'https://img.youtube.com/vi/GFhSsJk-6mY/maxresdefault.jpg',
  },
  {
    id: '7',
    title: 'المصادقة الثنائية (2FA) — خط الدفاع الثاني',
    description: 'لماذا المصادقة الثنائية مهمة وكيف تفعّلها على كل حساباتك. مقارنة بين أنواع المصادقة المختلفة.',
    category: 'passwords',
    duration: '9 دقائق',
    level: 'مبتدئ',
    youtubeId: 'hGRii5f_uSc',
    thumbnail: 'https://img.youtube.com/vi/hGRii5f_uSc/maxresdefault.jpg',
  },
  {
    id: '8',
    title: 'VPN — ما هو وهل تحتاجه فعلاً؟',
    description: 'شرح مبسط لتقنية VPN وكيف تحمي خصوصيتك على الإنترنت. متى تحتاج VPN ومتى لا تحتاجه.',
    category: 'privacy',
    duration: '12 دقيقة',
    level: 'متوسط',
    youtubeId: 'WVDQEoe6ZWY',
    thumbnail: 'https://img.youtube.com/vi/WVDQEoe6ZWY/maxresdefault.jpg',
  },
  {
    id: '9',
    title: 'هندسة اجتماعية — كيف يخدعك المخترقون؟',
    description: 'أخطر أساليب الهندسة الاجتماعية التي يستخدمها المخترقون للوصول إلى بياناتك. تعلم كيف تحمي نفسك من التلاعب النفسي.',
    category: 'phishing',
    duration: '16 دقيقة',
    level: 'متقدم',
    youtubeId: 'lc7scxvKQOo',
    thumbnail: 'https://img.youtube.com/vi/lc7scxvKQOo/maxresdefault.jpg',
  },
  {
    id: '10',
    title: 'تشفير البيانات — حماية ملفاتك الحساسة',
    description: 'كيف تشفر ملفاتك المهمة على الكمبيوتر والموبايل. شرح عملي لأدوات التشفير المجانية.',
    category: 'privacy',
    duration: '14 دقيقة',
    level: 'متقدم',
    youtubeId: 'jhXCTbFnK8o',
    thumbnail: 'https://img.youtube.com/vi/jhXCTbFnK8o/maxresdefault.jpg',
  },
  {
    id: '11',
    title: 'الدارك ويب — ما هو وهل بياناتك عليه؟',
    description: 'شرح مبسط للدارك ويب وكيف تتسرب بياناتك إليه. كيف تفحص إذا كانت معلوماتك الشخصية موجودة هناك.',
    category: 'email',
    duration: '11 دقيقة',
    level: 'متوسط',
    youtubeId: 'QBxVrKiS_a0',
    thumbnail: 'https://img.youtube.com/vi/QBxVrKiS_a0/maxresdefault.jpg',
  },
  {
    id: '12',
    title: 'أمان التطبيقات — صلاحيات خطيرة لازم تراجعها',
    description: 'التطبيقات على موبايلك ممكن تتجسس عليك! تعلم كيف تراجع الصلاحيات وتحذف التطبيقات الخطيرة.',
    category: 'mobile',
    duration: '10 دقائق',
    level: 'مبتدئ',
    youtubeId: 'JsKl22J9yXk',
    thumbnail: 'https://img.youtube.com/vi/JsKl22J9yXk/maxresdefault.jpg',
  },
];

const LEVEL_COLORS = {
  'مبتدئ': 'bg-green-500/20 text-green-400 border-green-500/30',
  'متوسط': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'متقدم': 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function CyberAcademy() {
  const { lang } = useLanguage();
  const [activeCategory, setActiveCategory] = useState('all');
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLessons = LESSONS.filter(l => {
    const matchesCategory = activeCategory === 'all' || l.category === activeCategory;
    const matchesSearch = !searchQuery || l.title.includes(searchQuery) || l.description.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest text-text-main">أكاديمية الأمن السيبراني</h1>
              <p className="text-xs text-text-dim font-mono">تعلم كيف تحمي نفسك من التهديدات الرقمية</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-dim font-mono">
          <BookOpen className="w-4 h-4" />
          <span>{LESSONS.length} درس متاح</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن درس..."
          className="w-full bg-bg-surface border border-border-subtle rounded-xl pr-10 pl-4 py-3 text-sm font-mono text-text-main placeholder:text-text-dim/40 focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                isActive
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'bg-bg-surface text-text-dim border-border-subtle hover:border-accent/20 hover:text-text-main'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Lessons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredLessons.map((lesson, idx) => (
            <motion.div
              key={lesson.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden hover:border-accent/30 transition-all group cursor-pointer"
              onClick={() => setPlayingVideo(lesson.id)}
            >
              {/* Thumbnail */}
              <div className="relative h-44 overflow-hidden">
                <img
                  src={lesson.thumbnail}
                  alt={lesson.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${lesson.youtubeId}/hqdefault.jpg`;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 bg-accent/90 rounded-full flex items-center justify-center shadow-lg shadow-accent/30">
                    <Play className="w-6 h-6 text-accent-fg mr-[-2px]" fill="currentColor" />
                  </div>
                </div>
                {/* Duration badge */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <Clock className="w-3 h-3 text-text-dim" />
                  <span className="text-[10px] font-mono text-white">{lesson.duration}</span>
                </div>
                {/* Level badge */}
                <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${LEVEL_COLORS[lesson.level]}`}>
                  {lesson.level}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-2">
                <h3 className="font-bold text-sm text-text-main leading-relaxed line-clamp-2">{lesson.title}</h3>
                <p className="text-xs text-text-dim leading-relaxed line-clamp-2">{lesson.description}</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-accent">
                    {CATEGORIES.find(c => c.id === lesson.category)?.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-text-dim group-hover:text-accent transition-colors rotate-180" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredLessons.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-text-dim/30 mx-auto mb-3" />
          <p className="text-text-dim font-mono text-sm">لا توجد دروس مطابقة للبحث</p>
        </div>
      )}

      {/* Video Player Modal */}
      <AnimatePresence>
        {playingVideo && (() => {
          const lesson = LESSONS.find(l => l.id === playingVideo);
          if (!lesson) return null;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4"
              onClick={() => setPlayingVideo(null)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-4xl bg-bg-base border border-border-subtle rounded-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${lesson.youtubeId}?autoplay=1&rel=0`}
                    title={lesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
                <div className="p-5 space-y-2">
                  <h2 className="text-lg font-bold text-text-main">{lesson.title}</h2>
                  <p className="text-sm text-text-dim leading-relaxed">{lesson.description}</p>
                  <div className="flex items-center gap-3 pt-2">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${LEVEL_COLORS[lesson.level]}`}>
                      {lesson.level}
                    </span>
                    <span className="text-[10px] font-mono text-text-dim flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {lesson.duration}
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
