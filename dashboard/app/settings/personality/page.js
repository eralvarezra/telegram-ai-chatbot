'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import AIConfigGenerator from '@/components/AIConfigGenerator';
import { Save, RefreshCw, Sparkles, MessageSquare, Zap, Target, AlertCircle, HelpCircle } from 'lucide-react';

// Tooltip component
const Tooltip = ({ text }) => (
  <div className="group relative inline-block ml-1">
    <HelpCircle size={14} className="text-zinc-500 cursor-help" />
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
      <div className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-3 py-2 max-w-xs whitespace-nowrap shadow-lg">
        {text}
      </div>
    </div>
  </div>
);

// Recommendation text component
const Recommendation = ({ text }) => (
  <p className="text-xs text-zinc-500 mt-1 italic">{text}</p>
);

export default function PersonalitySettingsPage() {
  const [config, setConfig] = useState({
    personality: '',
    tone: 'playful',
    style: ['short', 'casual'],
    engagement: 3,
    salesStrategy: '',
    restrictions: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const API_URL = 'http://localhost:3000';

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config/personality`);
      if (res.ok) {
        const data = await res.json();
        setConfig({
          personality: data.personality || '',
          tone: data.tone || 'playful',
          style: data.messageStyle || ['short', 'casual'],
          engagement: data.engagementLevel || 3,
          salesStrategy: data.salesStrategy || '',
          restrictions: data.restrictions || ''
        });
      }
    } catch (err) {
      console.error('Error fetching personality config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/config/personality`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: '✓ Personality configuration saved! Changes will apply to new messages.' });
        setTimeout(() => setMessage(null), 4000);
      } else {
        throw new Error('Error saving');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error saving configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleStyleToggle = (styleItem) => {
    setConfig(prev => {
      const currentStyles = prev.style || [];
      const newStyles = currentStyles.includes(styleItem)
        ? currentStyles.filter(s => s !== styleItem)
        : [...currentStyles, styleItem];
      return { ...prev, style: newStyles };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Personality Settings" />

      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">AI Personality Configuration</h2>
            <p className="text-zinc-400 mt-1">Customize how your bot behaves and communicates</p>
          </div>
          <a href="/settings" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Back to Settings
          </a>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg animate-fade-in ${
            message.type === 'success'
              ? 'bg-green-900/50 border border-green-800 text-green-200'
              : 'bg-red-900/50 border border-red-800 text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* AI Config Generator Section */}
        <AIConfigGenerator
          onConfigApplied={(newConfig) => {
            fetchConfig();
            setMessage({ type: 'success', text: 'AI Configuration applied successfully!' });
          }}
        />

        {/* Divider */}
        <div className="border-t border-zinc-800 my-8">
          <div className="relative -top-3 flex justify-center">
            <span className="bg-zinc-950 px-4 text-zinc-500 text-sm">or configure manually</span>
          </div>
        </div>

        <div className="space-y-6">
          {/* Base Personality */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="text-purple-500" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Bot Personality
                  <Tooltip text="Define how your assistant behaves overall" />
                </h3>
              </div>
            </div>

            <div>
              <textarea
                value={config.personality}
                onChange={(e) => handleChange('personality', e.target.value)}
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                placeholder="e.g., Caliente, atrevida, sin filtro. Te gusta hablar sucio. Coqueta pero no empalagosa."
              />
              <Recommendation text="Keep it short and clear. 2-4 lines works best." />
            </div>
          </div>

          {/* Tone Style */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="text-blue-500" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Tone Style
                  <Tooltip text="Controls the tone of responses" />
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { value: 'serious', label: 'Serious', desc: 'Professional, formal', color: 'bg-slate-600/20 border-slate-400' },
                { value: 'friendly', label: 'Friendly', desc: 'Warm, approachable', color: 'bg-green-600/20 border-green-500' },
                { value: 'sexy', label: 'Sexy', desc: 'Flirty, suggestive', color: 'bg-pink-600/20 border-pink-500' },
                { value: 'explicit', label: 'Explicit +18', desc: 'Adult content', color: 'bg-red-600/20 border-red-500' },
                { value: 'playful', label: 'Playful', desc: 'Fun, lighthearted', color: 'bg-purple-600/20 border-purple-500' }
              ].map(tone => (
                <button
                  key={tone.value}
                  onClick={() => handleChange('tone', tone.value)}
                  className={`p-4 rounded-lg border transition-all ${
                    config.tone === tone.value
                      ? `${tone.color} text-white border-current`
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div className="font-medium">{tone.label}</div>
                  <div className="text-xs opacity-70">{tone.desc}</div>
                </button>
              ))}
            </div>
            <Recommendation text="Choose based on your business type: Serious for professional services, Sexy/Explicit for adult content." />
          </div>

          {/* Message Style */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="text-yellow-500" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Message Style
                  <Tooltip text="Controls how messages are written" />
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'short', label: 'Short messages', desc: '1-2 lines max' },
                { value: 'emoji', label: 'Emojis', desc: 'Use emojis occasionally' },
                { value: 'casual', label: 'Casual language', desc: 'Natural chat style' },
                { value: 'multi-message', label: 'Multi-message replies', desc: 'Split longer responses' }
              ].map(style => (
                <button
                  key={style.value}
                  onClick={() => handleStyleToggle(style.value)}
                  className={`p-4 rounded-lg border transition-all ${
                    config.style?.includes(style.value)
                      ? 'bg-yellow-600/20 border-yellow-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div className="font-medium">{style.label}</div>
                  <div className="text-xs opacity-70">{style.desc}</div>
                </button>
              ))}
            </div>
            <Recommendation text="Short + casual messages feel more human." />
          </div>

          {/* Engagement Level */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="text-green-500" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Engagement Level
                  <Tooltip text="How proactive the assistant is in keeping conversations going" />
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={config.engagement}
                  onChange={(e) => handleChange('engagement', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <div className="text-2xl font-bold text-white min-w-[3rem] text-center">
                  {config.engagement}
                </div>
              </div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Passive</span>
                <span>Very Active</span>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-sm text-zinc-300">
                {config.engagement === 1 && 'Minimal engagement. Responds only when spoken to.'}
                {config.engagement === 2 && 'Low engagement. Occasional follow-ups.'}
                {config.engagement === 3 && 'Balanced engagement. Natural conversation flow.'}
                {config.engagement === 4 && 'High engagement. Asks questions, keeps conversation active.'}
                {config.engagement === 5 && 'Very high engagement. Proactively maintains interest and excitement.'}
              </div>
            </div>
            <Recommendation text="Higher values increase replies and questions." />
          </div>

          {/* Sales Strategy */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="text-orange-500" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Sales Strategy
                  <Tooltip text="Define how the assistant introduces offers" />
                </h3>
              </div>
            </div>

            <div>
              <textarea
                value={config.salesStrategy}
                onChange={(e) => handleChange('salesStrategy', e.target.value)}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                placeholder="e.g., Create curiosity before mentioning prices. Offer exclusivity. Never be pushy..."
              />
              <Recommendation text="Focus on curiosity and exclusivity instead of direct selling." />
            </div>
          </div>

          {/* Restrictions */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-red-500" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  Restrictions
                  <Tooltip text="Things the assistant should avoid saying or doing" />
                </h3>
              </div>
            </div>

            <div>
              <textarea
                value={config.restrictions}
                onChange={(e) => handleChange('restrictions', e.target.value)}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                placeholder="e.g., Never mention specific prices. Don't send payment info unless asked directly. Avoid medical topics..."
              />
              <Recommendation text="Use this to prevent unwanted behavior or tone." />
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-purple-600/50 disabled:to-blue-600/50 text-white font-medium rounded-xl transition-all transform hover:scale-[1.02] disabled:hover:scale-100 shadow-lg"
          >
            {saving ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                Saving Configuration...
              </>
            ) : (
              <>
                <Save size={20} />
                Save Personality Configuration
              </>
            )}
          </button>

          <p className="text-center text-zinc-500 text-sm">
            Changes apply immediately to new messages. No redeploy needed.
          </p>
        </div>
      </div>
    </div>
  );
}