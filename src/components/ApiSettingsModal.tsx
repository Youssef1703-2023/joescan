import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, X, Database, CheckCircle, BrainCircuit } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ApiSettings {
  provider: 'gemini' | 'groq' | 'grok';
  geminiKey: string;
  groqKey: string;
  grokKey: string;
}

export const getApiSettings = (): ApiSettings => {
  try {
    const stored = localStorage.getItem('joe_api_settings');
    if (stored) return { geminiKey: '', ...JSON.parse(stored) };
  } catch (e) {}
  return { provider: 'gemini', geminiKey: '', groqKey: '', grokKey: '' };
};

export const saveApiSettings = (settings: ApiSettings) => {
  localStorage.setItem('joe_api_settings', JSON.stringify(settings));
  window.dispatchEvent(new Event('api_settings_changed'));
};

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiSettingsModal({ isOpen, onClose }: ApiSettingsModalProps) {
  const { t, lang } = useLanguage();
  const [settings, setSettings] = useState<ApiSettings>(getApiSettings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getApiSettings());
      setSaved(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    saveApiSettings(settings);
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-bg-base border border-border-subtle rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative"
        >
          <div className="p-6 border-b border-border-subtle flex justify-between items-center bg-bg-surface">
            <h2 className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-accent" />
              {t('api_settings_title')}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-bg-base/50 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <p className="text-sm opacity-80 leading-relaxed">
              {t('api_settings_desc')}
            </p>

            <div className="space-y-4">
              <label className="flex flex-col gap-3 p-4 bg-bg-surface border border-border-subtle rounded-lg cursor-pointer hover:border-accent transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="provider"
                    value="gemini"
                    checked={settings.provider === 'gemini'}
                    onChange={() => setSettings(s => ({ ...s, provider: 'gemini' }))}
                    className="w-4 h-4 text-accent bg-transparent border-[currentColor]/30 focus:ring-accent"
                  />
                  <div>
                    <div className="font-bold">{t('provider_gemini')}</div>
                    <div className="text-xs opacity-60">{t('provider_gemini_desc')}</div>
                  </div>
                </div>
                {settings.provider === 'gemini' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-2 space-y-2">
                    <label className="text-[11px] font-mono uppercase tracking-widest text-text-dim">Gemini API Key</label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={settings.geminiKey}
                      onChange={e => setSettings(s => ({ ...s, geminiKey: e.target.value }))}
                      className="w-full bg-bg-base border border-border-subtle rounded-lg p-3 outline-none focus:border-accent font-mono text-sm"
                    />
                    <p className="text-[10px] opacity-50">Get your free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-accent underline">aistudio.google.com/apikey</a></p>
                  </motion.div>
                )}
              </label>

              <label className="flex flex-col gap-3 p-4 bg-bg-surface border border-border-subtle rounded-lg cursor-pointer hover:border-accent transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="provider"
                    value="groq"
                    checked={settings.provider === 'groq'}
                    onChange={() => setSettings(s => ({ ...s, provider: 'groq' }))}
                    className="w-4 h-4 text-accent bg-transparent border-[currentColor]/30 focus:ring-accent"
                  />
                  <div>
                    <div className="font-bold">{t('provider_groq')}</div>
                    <div className="text-xs opacity-60">Uses Llama-3 models. Get a key at <a href="https://console.groq.com/" target="_blank" rel="noreferrer" className="text-accent underline">console.groq.com</a>.</div>
                  </div>
                </div>
                {settings.provider === 'groq' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-2">
                    <input
                      type="password"
                      placeholder="gsk_..."
                      value={settings.groqKey}
                      onChange={e => setSettings(s => ({ ...s, groqKey: e.target.value }))}
                      className="w-full bg-bg-base border border-border-subtle rounded-lg p-3 outline-none focus:border-accent"
                    />
                  </motion.div>
                )}
              </label>

              <label className="flex flex-col gap-3 p-4 bg-bg-surface border border-border-subtle rounded-lg cursor-pointer hover:border-accent transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="provider"
                    value="grok"
                    checked={settings.provider === 'grok'}
                    onChange={() => setSettings(s => ({ ...s, provider: 'grok' }))}
                    className="w-4 h-4 text-accent bg-transparent border-[currentColor]/30 focus:ring-accent"
                  />
                  <div>
                    <div className="font-bold">{t('provider_grok')}</div>
                    <div className="text-xs opacity-60">Requires xAI API key. Get a key at <a href="https://console.x.ai/" target="_blank" rel="noreferrer" className="text-accent underline">console.x.ai</a>.</div>
                  </div>
                </div>
                {settings.provider === 'grok' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-2">
                    <input
                      type="password"
                      placeholder="xai-..."
                      value={settings.grokKey}
                      onChange={e => setSettings(s => ({ ...s, grokKey: e.target.value }))}
                      className="w-full bg-bg-base border border-border-subtle rounded-lg p-3 outline-none focus:border-accent"
                    />
                  </motion.div>
                )}
              </label>
            </div>
          </div>

          <div className="p-6 border-t border-border-subtle bg-bg-surface flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg opacity-80 hover:opacity-100 transition-opacity">
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              className="bg-accent text-accent-fg px-6 py-2.5 rounded-lg font-bold tracking-wider hover:bg-opacity-90 flex items-center gap-2 transition-all"
            >
              {saved ? <><CheckCircle className="w-5 h-5"/> {t('saved_verb')}</> : t('save_changes')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
