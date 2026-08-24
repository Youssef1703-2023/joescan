import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, CheckCircle2, Clock, BookOpen, HelpCircle, ArrowRight, ArrowLeft, Award, Sparkles, Filter, ShieldCheck, ChevronRight, Lock, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { auth, db, updateLessonProgress } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { LESSONS, Lesson, QuizQuestion } from '../data/lessons';

export default function CyberAcademy() {
  const { lang, t } = useLanguage();
  const isAr = lang === 'ar';

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [savingProgress, setSavingProgress] = useState(false);

  // Subscribe to user completedLessons from Firestore
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.completedLessons)) {
          setCompletedLessonIds(data.completedLessons);
        }
      }
    });

    return () => unsub();
  }, []);

  const categories = [
    { id: 'all', label: isAr ? 'جميع الدروس' : 'All Lessons' },
    { id: 'Fundamentals', label: isAr ? 'أساسيات الأمان' : 'Fundamentals' },
    { id: 'Authentication', label: isAr ? 'المصادقة وإدارة الهوية' : 'Authentication' },
    { id: 'Threat Defense', label: isAr ? 'مكافحة التهديدات' : 'Threat Defense' },
    { id: 'Privacy & OSINT', label: isAr ? 'الخصوصية واستخبارات OSINT' : 'Privacy & OSINT' },
  ];

  const filteredLessons = LESSONS.filter(l => {
    if (selectedCategory === 'all') return true;
    return l.category === selectedCategory;
  });

  const completionPercentage = Math.round((completedLessonIds.length / LESSONS.length) * 100);

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleCompleteLesson = async (lesson: Lesson) => {
    const user = auth.currentUser;
    if (!user) {
      alert(isAr ? 'يرجى تسجيل الدخول لحفظ تقدمك التعليمي.' : 'Please sign in to save your learning progress.');
      return;
    }

    setSavingProgress(true);
    try {
      await updateLessonProgress(user.uid, lesson.id, true);
      setCompletedLessonIds(prev => Array.from(new Set([...prev, lesson.id])));
    } catch (err) {
      console.error('Failed to save lesson completion:', err);
    } finally {
      setSavingProgress(false);
    }
  };

  // ─── Lesson Reader View ───
  if (activeLesson) {
    const isCompleted = completedLessonIds.includes(activeLesson.id);
    const allQuestionsAnswered = activeLesson.quiz.every(q => quizAnswers[q.id] !== undefined);
    const allQuestionsCorrect = activeLesson.quiz.every(q => quizAnswers[q.id] === q.correctAnswerIndex);

    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-16 w-full" dir={isAr ? 'rtl' : 'ltr'}>
        {/* Navigation & Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <button
            onClick={() => {
              setActiveLesson(null);
              setQuizAnswers({});
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-surface border border-border-subtle text-text-dim hover:text-text-main text-xs font-bold uppercase transition-all"
          >
            {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {isAr ? 'العودة لقائمة الدروس' : 'Back to Academy'}
          </button>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-mono font-bold">
              {isAr ? activeLesson.categoryAr : activeLesson.category}
            </span>
            <span className="flex items-center gap-1 text-xs font-mono text-text-dim">
              <Clock className="w-3.5 h-3.5" /> {activeLesson.estimatedMinutes} {isAr ? 'دقائق' : 'min'}
            </span>
          </div>
        </div>

        {/* Lesson Hero */}
        <div className="glass-card p-6 md:p-8 rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-transparent space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
            <BookOpen className="w-4 h-4" />
            {isAr ? 'وحدة تدريبية تفاعلية' : 'Interactive Training Module'}
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-text-main">
            {isAr ? activeLesson.titleAr : activeLesson.title}
          </h1>
          <p className="text-sm md:text-base text-text-dim leading-relaxed">
            {isAr ? activeLesson.summaryAr : activeLesson.summary}
          </p>
        </div>

        {/* Lesson Body Sections */}
        <div className="space-y-6">
          {activeLesson.sections.map((sec, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card p-6 md:p-8 rounded-2xl space-y-4"
            >
              <h2 className="text-lg md:text-xl font-bold text-text-main flex items-center gap-2">
                <span className="text-cyan-400 font-mono">0{idx + 1}.</span> {isAr ? sec.titleAr : sec.title}
              </h2>
              <p className="text-sm md:text-base text-text-dim leading-relaxed whitespace-pre-line">
                {isAr ? sec.contentAr : sec.content}
              </p>

              {/* Key Takeaways */}
              {sec.keyPoints && sec.keyPoints.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-bg-surface/80 border border-border-subtle/70 space-y-2">
                  <div className="text-xs font-mono font-bold uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> {isAr ? 'النقاط الجوهرية والتحذيرات' : 'Key Takeaways & Protocol'}
                  </div>
                  <ul className="space-y-1.5 text-xs md:text-sm text-text-main/90">
                    {(isAr ? sec.keyPointsAr || sec.keyPoints : sec.keyPoints).map((kp, kIdx) => (
                      <li key={kIdx} className="flex items-start gap-2">
                        <span className="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
                        <span>{kp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Interactive Quiz Section */}
        <div className="glass-card p-6 md:p-8 rounded-2xl border border-cyan-500/30 space-y-6">
          <div className="flex items-center gap-2 text-cyan-400">
            <HelpCircle className="w-6 h-6" />
            <h2 className="text-xl font-bold">{isAr ? 'اختبار التحقق والفهم' : 'Knowledge Check Quiz'}</h2>
          </div>

          <div className="space-y-6">
            {activeLesson.quiz.map((q, qIdx) => {
              const selectedIdx = quizAnswers[q.id];
              const isAnswered = selectedIdx !== undefined;
              const isCorrect = selectedIdx === q.correctAnswerIndex;
              const options = isAr ? q.optionsAr : q.options;

              return (
                <div key={q.id} className="p-5 rounded-xl bg-bg-surface border border-border-subtle space-y-3">
                  <div className="text-sm md:text-base font-bold text-text-main">
                    <span className="font-mono text-cyan-400 mr-2">Q{qIdx + 1}:</span>
                    {isAr ? q.questionAr : q.question}
                  </div>

                  <div className="space-y-2">
                    {options.map((opt, optIdx) => {
                      let btnStyle = 'border-border-subtle hover:border-border-main bg-bg-base/60 text-text-dim';
                      if (isAnswered) {
                        if (optIdx === q.correctAnswerIndex) {
                          btnStyle = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400 font-bold';
                        } else if (selectedIdx === optIdx) {
                          btnStyle = 'border-rose-500/60 bg-rose-500/10 text-rose-400';
                        } else {
                          btnStyle = 'border-border-subtle/40 bg-bg-base/30 text-text-dim/40 opacity-60';
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectAnswer(q.id, optIdx)}
                          className={`w-full p-3 rounded-xl border text-left text-xs md:text-sm transition-all flex items-center justify-between gap-3 ${btnStyle}`}
                        >
                          <span className="flex-1">{opt}</span>
                          {isAnswered && optIdx === q.correctAnswerIndex && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback Explanation */}
                  {isAnswered && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-lg text-xs font-mono border ${
                        isCorrect
                          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                          : 'border-rose-500/20 bg-rose-500/5 text-rose-300'
                      }`}
                    >
                      <div className="font-bold mb-1">
                        {isCorrect ? (isAr ? '✓ إجابة صحيحة' : '✓ Correct!') : (isAr ? '✕ إجابة غير دقيقة' : '✕ Incorrect')}
                      </div>
                      <div>{isAr ? q.explanationAr : q.explanation}</div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Lesson Completion Action */}
          <div className="pt-4 border-t border-border-subtle flex items-center justify-between flex-wrap gap-4">
            <div className="text-xs font-mono text-text-dim">
              {isCompleted ? (
                <span className="text-emerald-400 flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-4 h-4" /> {isAr ? 'تم إكمال هذا الدرس بنجاح' : 'Lesson Completed & Verified'}
                </span>
              ) : allQuestionsCorrect ? (
                <span className="text-cyan-400">
                  {isAr ? 'أحسنت! يمكنك الآن تأكيد إنهاء الدرس.' : 'All answers correct! You can now mark this lesson complete.'}
                </span>
              ) : (
                <span>
                  {isAr ? 'أجب على جميع الأسئلة بشكل صحيح لإكمال الوحدة.' : 'Answer the questions correctly to complete the module.'}
                </span>
              )}
            </div>

            <button
              onClick={() => handleCompleteLesson(activeLesson)}
              disabled={savingProgress || isCompleted || !allQuestionsCorrect}
              className="px-6 py-3 rounded-xl bg-cyan-500 text-black font-black uppercase text-xs tracking-wider hover:bg-cyan-400 transition-all disabled:opacity-40 flex items-center gap-2"
            >
              {isCompleted ? (
                <><Check className="w-4 h-4" /> {isAr ? 'مكتمل' : 'Completed'}</>
              ) : (
                <><Award className="w-4 h-4" /> {savingProgress ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'تأكيد إكمال الدرس' : 'Complete Lesson')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Lesson List / Grid View ───
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 w-full" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-cyan-400" /> {t('nav_academy')}
          </h1>
          <p className="text-text-dim text-sm mt-1 font-mono">
            {isAr
              ? 'أكاديمية تعليمية تفاعلية للثقافة والأمن السيبراني، مع دروس عملية واختبارات لتقييم الفهم.'
              : 'Interactive cybersecurity academy with practical defensive modules and knowledge-check quizzes.'}
          </p>
        </div>
      </div>

      {/* Progress Summary Card */}
      <div className="glass-card p-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-transparent to-transparent flex items-center justify-between flex-wrap gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider font-bold">
            <Sparkles className="w-4 h-4" /> {isAr ? 'مسار التدريب السيبراني' : 'Cyber Defense Track'}
          </div>
          <div className="text-xl md:text-2xl font-black text-text-main">
            {completedLessonIds.length} {isAr ? 'من أصل' : 'of'} {LESSONS.length} {isAr ? 'دروس مكتملة' : 'Lessons Completed'}
          </div>
          <p className="text-xs font-mono text-text-dim">
            {isAr ? 'أكمل جميع الوحدات لتثبيت ممارسات الدفاع والأمان الرقمي.' : 'Master all modules to establish rock-solid digital defense habits.'}
          </p>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="flex items-center gap-4 min-w-[220px]">
          <div className="flex-1 bg-bg-surface rounded-full h-3.5 overflow-hidden border border-border-subtle p-0.5">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <span className="text-lg font-black font-mono text-cyan-400">{completionPercentage}%</span>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide text-xs font-mono">
        <span className="text-text-dim uppercase text-[10px] tracking-widest flex items-center gap-1 shrink-0">
          <Filter className="w-3 h-3" /> Filter:
        </span>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl border uppercase transition-all shrink-0 font-bold ${
              selectedCategory === cat.id
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                : 'border-border-subtle text-text-dim hover:text-text-main hover:border-border-main'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Lesson Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredLessons.map((lesson, index) => {
          const isDone = completedLessonIds.includes(lesson.id);

          return (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setActiveLesson(lesson)}
              className={`glass-card p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover:border-cyan-500/50 hover:shadow-lg group ${
                isDone ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border-subtle'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                    {isAr ? lesson.categoryAr : lesson.category}
                  </span>
                  {isDone ? (
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {isAr ? 'مكتمل' : 'Completed'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-text-dim flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {lesson.estimatedMinutes} {isAr ? 'د' : 'min'}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-text-main group-hover:text-cyan-300 transition-colors">
                    {isAr ? lesson.titleAr : lesson.title}
                  </h3>
                  <p className="text-xs text-text-dim mt-2 line-clamp-3 leading-relaxed">
                    {isAr ? lesson.summaryAr : lesson.summary}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border-subtle flex items-center justify-between text-xs font-mono">
                <span className="text-text-dim/80">
                  {lesson.sections.length} {isAr ? 'أقسام' : 'sections'} • {lesson.quiz.length} {isAr ? 'أسئلة' : 'quiz Qs'}
                </span>
                <span className="text-cyan-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  {isAr ? 'ابدأ الدرس' : 'Start'} <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
