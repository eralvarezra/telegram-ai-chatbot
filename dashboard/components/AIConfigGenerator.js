'use client';

import { useState } from 'react';
import { RefreshCw, Check, Edit2, AlertCircle, Sparkles, Wand2, Plus, X, Package, AlertOctagon } from 'lucide-react';
import { generateAIConfig, regenerateAIConfig, applyAIConfig } from '@/lib/api';
import { useI18n } from '@/src/i18n';

export default function AIConfigGenerator({ onConfigApplied }) {
  const { t, locale } = useI18n();
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [generationId, setGenerationId] = useState(null);
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState(null);
  const [tweakInstruction, setTweakInstruction] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Tone labels using translations
  const toneLabels = {
    serious: { label: t('aiConfig.tones.serious'), color: 'bg-slate-600/20 border-slate-400', description: 'Profesional y formal' },
    friendly: { label: t('aiConfig.tones.friendly'), color: 'bg-green-600/20 border-green-500', description: 'Cercano y amable' },
    sexy: { label: t('aiConfig.tones.sexy'), color: 'bg-pink-600/20 border-pink-500', description: 'Coqueto y sugerente' },
    explicit: { label: t('aiConfig.tones.explicit'), color: 'bg-red-600/20 border-red-500', description: 'Contenido adulto +18' },
    playful: { label: t('aiConfig.tones.playful'), color: 'bg-purple-600/20 border-purple-500', description: 'Divertido y ligero' }
  };

  const formalityLabels = {
    low: t('aiConfig.formalityLevels.low'),
    medium: t('aiConfig.formalityLevels.medium'),
    high: t('aiConfig.formalityLevels.high')
  };

  const emojiLabels = {
    low: t('aiConfig.emojiLevels.low'),
    medium: t('aiConfig.emojiLevels.medium'),
    high: t('aiConfig.emojiLevels.high')
  };

  const lengthLabels = {
    short: t('aiConfig.lengthLevels.short'),
    medium: t('aiConfig.lengthLevels.medium'),
    long: t('aiConfig.lengthLevels.long')
  };

  const approachLabels = {
    soft: t('aiConfig.approaches.soft'),
    direct: t('aiConfig.approaches.direct'),
    aggressive: t('aiConfig.approaches.aggressive')
  };

  const ctaLabels = {
    subtle: t('aiConfig.ctaStyles.subtle'),
    persuasive: t('aiConfig.ctaStyles.persuasive'),
    urgent: t('aiConfig.ctaStyles.urgent')
  };

  const handleGenerate = async () => {
    if (!description.trim() || description.length < 10) {
      setError(t('aiConfig.errors.minLength'));
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await generateAIConfig(description, locale);

      if (result.success) {
        setGenerationId(result.generationId);
        setGeneratedConfig({
          ...result.config,
          restricted_topics: result.config?.restricted_topics || []
        });
        setEditedConfig({
          ...result.config,
          restricted_topics: result.config?.restricted_topics || []
        });
      } else {
        setError(result.error || t('aiConfig.errors.generationFailed'));
      }
    } catch (err) {
      setError(err.message || t('aiConfig.errors.generationFailed'));
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!tweakInstruction.trim() || !generationId) return;

    setRegenerating(true);
    setError(null);

    try {
      const result = await regenerateAIConfig(generationId, tweakInstruction);

      if (result.success) {
        setGenerationId(result.generationId);
        setGeneratedConfig({
          ...result.config,
          restricted_topics: result.config?.restricted_topics || []
        });
        setEditedConfig({
          ...result.config,
          restricted_topics: result.config?.restricted_topics || []
        });
        setTweakInstruction('');
        setSuccessMessage(locale === 'es' ? '¡Configuración actualizada!' : 'Configuration updated!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || t('aiConfig.errors.generationFailed'));
      }
    } catch (err) {
      setError(err.message || t('aiConfig.errors.generationFailed'));
    } finally {
      setRegenerating(false);
    }
  };

  const handleApply = async () => {
    if (!generationId) return;

    setApplying(true);
    setError(null);

    try {
      // Clean up temporary fields and filter empty restrictions
      const configToApply = isEditing ? editedConfig : generatedConfig;
      const cleanConfig = {
        ...configToApply,
        restricted_topics: configToApply?.restricted_topics?.filter(t => t && t.trim()) || []
      };
      delete cleanConfig._newRestriction;

      const result = await applyAIConfig(generationId, cleanConfig);

      if (result.success) {
        setSuccessMessage(t('aiConfig.success'));
        setTimeout(() => {
          setSuccessMessage(null);
          if (onConfigApplied) onConfigApplied(result.config);
        }, 2000);
      } else {
        setError(result.error || t('aiConfig.errors.applyFailed'));
      }
    } catch (err) {
      setError(err.message || t('aiConfig.errors.applyFailed'));
    } finally {
      setApplying(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setGeneratedConfig(editedConfig);
    }
    setIsEditing(!isEditing);
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Wand2 className="text-purple-500" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('aiConfig.title')}
            </h3>
            <p className="text-sm text-zinc-400">
              {t('aiConfig.subtitle')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
            placeholder={t('aiConfig.placeholder')}
            disabled={generating}
          />

          <button
            onClick={handleGenerate}
            disabled={generating || !description.trim() || description.length < 10}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-zinc-600 disabled:to-zinc-600 text-white font-medium rounded-lg transition-all disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                {t('aiConfig.generating')}
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {t('aiConfig.generateButton')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/50 border border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <span className="text-red-200">{error}</span>
            {(error.includes('API') || error.includes('key') || error.includes('configur')) && (
              <a href="/settings" className="block mt-2 text-blue-400 hover:text-blue-300 text-sm underline">
                {t('aiConfig.goToSettings')}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-900/50 border border-green-800 rounded-lg p-4 flex items-center gap-3">
          <Check className="text-green-400" size={20} />
          <span className="text-green-200">{successMessage}</span>
        </div>
      )}

      {/* Preview Card */}
      {generatedConfig && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles className="text-yellow-500" size={20} />
              {t('aiConfig.previewTitle')}
            </h3>
            <button
              onClick={handleEditToggle}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isEditing
                  ? 'bg-green-600/20 border border-green-500 text-green-300 hover:bg-green-600/30'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {isEditing ? <Check size={16} /> : <Edit2 size={16} />}
              {isEditing ? t('aiConfig.saveEditsButton') : t('aiConfig.editButton')}
            </button>
          </div>

          {/* Tone */}
          <div className="mb-4">
            <label className="text-sm text-zinc-400 mb-2 block">
              {t('aiConfig.tone')}
            </label>
            {isEditing ? (
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(toneLabels).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setEditedConfig(prev => ({ ...prev, tone: key }))}
                    className={`p-2 rounded-lg border text-sm ${
                      editedConfig?.tone === key ? value.color + ' text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    {value.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className={`inline-flex px-3 py-1.5 rounded-lg border text-sm ${toneLabels[generatedConfig.tone]?.color || 'bg-zinc-800 border-zinc-700'}`}>
                {toneLabels[generatedConfig.tone]?.label || generatedConfig.tone}
              </div>
            )}
          </div>

          {/* Communication Style */}
          <div className="mb-4">
            <label className="text-sm text-zinc-400 mb-2 block">
              {t('aiConfig.communicationStyle')}
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-xs text-zinc-500">{t('aiConfig.formality')}</span>
                {isEditing ? (
                  <select
                    value={editedConfig?.communication_style?.formality}
                    onChange={(e) => setEditedConfig(prev => ({
                      ...prev,
                      communication_style: { ...prev.communication_style, formality: e.target.value }
                    }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                  >
                    {Object.entries(formalityLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white">{formalityLabels[generatedConfig.communication_style?.formality]}</p>
                )}
              </div>
              <div>
                <span className="text-xs text-zinc-500">{t('aiConfig.emojiUsage')}</span>
                {isEditing ? (
                  <select
                    value={editedConfig?.communication_style?.emoji_usage}
                    onChange={(e) => setEditedConfig(prev => ({
                      ...prev,
                      communication_style: { ...prev.communication_style, emoji_usage: e.target.value }
                    }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                  >
                    {Object.entries(emojiLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white">{emojiLabels[generatedConfig.communication_style?.emoji_usage]}</p>
                )}
              </div>
              <div>
                <span className="text-xs text-zinc-500">{t('aiConfig.messageLength')}</span>
                {isEditing ? (
                  <select
                    value={editedConfig?.communication_style?.message_length}
                    onChange={(e) => setEditedConfig(prev => ({
                      ...prev,
                      communication_style: { ...prev.communication_style, message_length: e.target.value }
                    }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                  >
                    {Object.entries(lengthLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white">{lengthLabels[generatedConfig.communication_style?.message_length]}</p>
                )}
              </div>
            </div>
          </div>

          {/* Sales Strategy */}
          <div className="mb-4">
            <label className="text-sm text-zinc-400 mb-2 block">
              {t('aiConfig.salesStrategy')}
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-xs text-zinc-500">{t('aiConfig.approach')}</span>
                {isEditing ? (
                  <select
                    value={editedConfig?.sales_strategy?.approach}
                    onChange={(e) => setEditedConfig(prev => ({
                      ...prev,
                      sales_strategy: { ...prev.sales_strategy, approach: e.target.value }
                    }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                  >
                    {Object.entries(approachLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white">{approachLabels[generatedConfig.sales_strategy?.approach]}</p>
                )}
              </div>
              <div>
                <span className="text-xs text-zinc-500">{t('aiConfig.upsellFrequency')}</span>
                <p className="text-white capitalize">{generatedConfig.sales_strategy?.upsell_frequency}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500">{t('aiConfig.callToAction')}</span>
                {isEditing ? (
                  <select
                    value={editedConfig?.sales_strategy?.call_to_action_style}
                    onChange={(e) => setEditedConfig(prev => ({
                      ...prev,
                      sales_strategy: { ...prev.sales_strategy, call_to_action_style: e.target.value }
                    }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                  >
                    {Object.entries(ctaLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white">{ctaLabels[generatedConfig.sales_strategy?.call_to_action_style]}</p>
                )}
              </div>
            </div>
          </div>

          {/* Target Audience & Business Type */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">
                {t('aiConfig.targetAudience')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedConfig?.target_audience || ''}
                  onChange={(e) => setEditedConfig(prev => ({ ...prev, target_audience: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                />
              ) : (
                <p className="text-white">{generatedConfig.target_audience}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">
                {t('aiConfig.businessType')}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedConfig?.business_type || ''}
                  onChange={(e) => setEditedConfig(prev => ({ ...prev, business_type: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                />
              ) : (
                <p className="text-white">{generatedConfig.business_type}</p>
              )}
            </div>
          </div>

          {/* Example Messages */}
          <div className="mb-4">
            <label className="text-sm text-zinc-400 mb-2 block">
              {t('aiConfig.exampleMessages')}
            </label>
            <div className="space-y-2">
              {(isEditing ? editedConfig : generatedConfig)?.example_messages?.map((msg, idx) => (
                <div key={idx} className="bg-zinc-800/50 rounded-lg p-3 text-sm text-zinc-300">
                  {isEditing ? (
                    <input
                      type="text"
                      value={msg}
                      onChange={(e) => {
                        const newMessages = [...(editedConfig?.example_messages || [])];
                        newMessages[idx] = e.target.value;
                        setEditedConfig(prev => ({ ...prev, example_messages: newMessages }));
                      }}
                      className="w-full bg-transparent border-none text-white text-sm focus:outline-none"
                    />
                  ) : (
                    msg
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Restricted Topics */}
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <label className="text-sm text-zinc-400 flex items-center gap-2">
                <AlertOctagon size={16} className="text-red-400" />
                {t('aiConfig.restrictions')}
              </label>
            </div>
            <p className="text-xs text-zinc-500 mb-2">{t('aiConfig.restrictionsHint')}</p>

            {isEditing ? (
              <div className="space-y-2">
                {editedConfig?.restricted_topics?.filter(t => t && t.trim() !== '').map((topic, idx, filteredArray) => {
                  // Find the real index in the original array
                  const realIndex = editedConfig?.restricted_topics?.indexOf(topic);
                  return (
                    <div key={`restriction-${idx}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => {
                          if (realIndex !== -1 && realIndex !== undefined) {
                            const newTopics = [...(editedConfig?.restricted_topics || [])];
                            newTopics[realIndex] = e.target.value;
                            setEditedConfig(prev => ({ ...prev, restricted_topics: newTopics }));
                          }
                        }}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                        placeholder={t('aiConfig.restrictionsPlaceholder')}
                      />
                      <button
                        onClick={() => {
                          if (realIndex !== -1 && realIndex !== undefined) {
                            const newTopics = [...(editedConfig?.restricted_topics || [])];
                            newTopics.splice(realIndex, 1);
                            setEditedConfig(prev => ({ ...prev, restricted_topics: newTopics }));
                          }
                        }}
                        className="p-2 bg-red-600/20 rounded hover:bg-red-600/40 text-red-300"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
                {/* Input for adding new restriction */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedConfig?._newRestriction || ''}
                    onChange={(e) => {
                      setEditedConfig(prev => ({ ...prev, _newRestriction: e.target.value }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editedConfig?._newRestriction?.trim()) {
                        const newTopics = [...(editedConfig?.restricted_topics || []), editedConfig._newRestriction.trim()];
                        setEditedConfig(prev => ({
                          ...prev,
                          restricted_topics: newTopics,
                          _newRestriction: ''
                        }));
                      }
                    }}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                    placeholder={t('aiConfig.restrictionsPlaceholder')}
                  />
                  <button
                    onClick={() => {
                      if (editedConfig?._newRestriction?.trim()) {
                        const newTopics = [...(editedConfig?.restricted_topics || []), editedConfig._newRestriction.trim()];
                        setEditedConfig(prev => ({
                          ...prev,
                          restricted_topics: newTopics,
                          _newRestriction: ''
                        }));
                      }
                    }}
                    className="px-3 py-2 bg-red-600/20 border border-red-500 text-red-300 rounded text-sm hover:bg-red-600/30"
                  >
                    {t('aiConfig.addRestriction')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {(isEditing ? editedConfig : generatedConfig)?.restricted_topics?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(isEditing ? editedConfig : generatedConfig)?.restricted_topics?.filter(t => t !== '')?.map((topic, idx) => (
                      <span key={idx} className="px-2 py-1 bg-red-900/30 border border-red-800 rounded text-sm text-red-300">
                        {topic}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm italic">{t('aiConfig.restrictionsEmpty')}</p>
                )}
              </>
            )}
          </div>

          {/* Products/Services Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-zinc-400 flex items-center gap-2">
                <Package size={16} />
                {t('aiConfig.products')}
              </label>
              {isEditing && (
                <button
                  onClick={() => {
                    const newProduct = { name: '', description: '', price_range: 'Consultar', category: 'service' };
                    setEditedConfig(prev => ({
                      ...prev,
                      products: [...(prev?.products || []), newProduct]
                    }));
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 border border-blue-500 text-blue-300 rounded text-xs hover:bg-blue-600/30"
                >
                  <Plus size={14} />
                  {t('aiConfig.addProduct')}
                </button>
              )}
            </div>

            {isEditing && (
              <p className="text-xs text-zinc-500 mb-2">{t('aiConfig.priceNote')}</p>
            )}

            <div className="space-y-3">
              {(isEditing ? editedConfig : generatedConfig)?.products?.map((product, idx) => (
                <div key={idx} className="bg-zinc-800/50 rounded-lg p-3 relative">
                  {isEditing && editedConfig?.products?.length > 1 && (
                    <button
                      onClick={() => {
                        const newProducts = editedConfig.products.filter((_, i) => i !== idx);
                        setEditedConfig(prev => ({ ...prev, products: newProducts }));
                      }}
                      className="absolute top-2 right-2 p-1 bg-red-600/20 rounded hover:bg-red-600/40 text-red-300"
                    >
                      <X size={14} />
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <span className="text-xs text-zinc-500">{t('aiConfig.productName')}</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={product.name || ''}
                          onChange={(e) => {
                            const newProducts = [...editedConfig.products];
                            newProducts[idx] = { ...newProducts[idx], name: e.target.value };
                            setEditedConfig(prev => ({ ...prev, products: newProducts }));
                          }}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-sm"
                          placeholder={t('aiConfig.productNamePlaceholder')}
                        />
                      ) : (
                        <p className="text-white font-medium">{product.name}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500">{t('aiConfig.productPrice')}</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={product.price_range || ''}
                          onChange={(e) => {
                            const newProducts = [...editedConfig.products];
                            newProducts[idx] = { ...newProducts[idx], price_range: e.target.value };
                            setEditedConfig(prev => ({ ...prev, products: newProducts }));
                          }}
                          className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-sm"
                          placeholder={t('aiConfig.productPricePlaceholder')}
                        />
                      ) : (
                        <p className="text-white">{product.price_range || '-'}</p>
                      )}
                    </div>
                  </div>

                  <div className="mb-2">
                    <span className="text-xs text-zinc-500">{t('aiConfig.productDescription')}</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={product.description || ''}
                        onChange={(e) => {
                          const newProducts = [...editedConfig.products];
                          newProducts[idx] = { ...newProducts[idx], description: e.target.value };
                          setEditedConfig(prev => ({ ...prev, products: newProducts }));
                        }}
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-sm"
                        placeholder={t('aiConfig.productDescriptionPlaceholder')}
                      />
                    ) : (
                      <p className="text-zinc-300 text-sm">{product.description}</p>
                    )}
                  </div>

                  <div>
                    <span className="text-xs text-zinc-500">{t('aiConfig.productCategory')}</span>
                    {isEditing ? (
                      <select
                        value={product.category || 'service'}
                        onChange={(e) => {
                          const newProducts = [...editedConfig.products];
                          newProducts[idx] = { ...newProducts[idx], category: e.target.value };
                          setEditedConfig(prev => ({ ...prev, products: newProducts }));
                        }}
                        className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-sm"
                      >
                        <option value="content">{t('aiConfig.categoryContent')}</option>
                        <option value="service">{t('aiConfig.categoryService')}</option>
                        <option value="product">{t('aiConfig.categoryProduct')}</option>
                        <option value="subscription">{t('aiConfig.categorySubscription')}</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                        product.category === 'content' ? 'bg-purple-600/20 text-purple-300' :
                        product.category === 'service' ? 'bg-blue-600/20 text-blue-300' :
                        product.category === 'product' ? 'bg-green-600/20 text-green-300' :
                        'bg-orange-600/20 text-orange-300'
                      }`}>
                        {product.category || 'service'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {(!generatedConfig?.products || generatedConfig.products.length === 0) && !isEditing && (
              <p className="text-zinc-500 text-sm italic">{t('aiConfig.noProducts')}</p>
            )}
          </div>

          {/* Regenerate with Tweaks */}
          <div className="mb-4 pt-4 border-t border-zinc-800">
            <label className="text-sm text-zinc-400 mb-2 block">
              {t('aiConfig.wantToTweak')}
            </label>
            <p className="text-xs text-zinc-500 mb-2">{t('aiConfig.tweakHint')}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={tweakInstruction}
                onChange={(e) => setTweakInstruction(e.target.value)}
                placeholder={t('aiConfig.tweakPlaceholder')}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                disabled={regenerating}
              />
              <button
                onClick={handleRegenerate}
                disabled={regenerating || !tweakInstruction.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {regenerating ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                {t('aiConfig.regenerateButton')}
              </button>
            </div>
          </div>

          {/* Apply Button */}
          <button
            onClick={handleApply}
            disabled={applying}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-zinc-600 disabled:to-zinc-600 text-white font-medium rounded-lg transition-all"
          >
            {applying ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                {t('aiConfig.applying')}
              </>
            ) : (
              <>
                <Check size={18} />
                {t('aiConfig.applyButton')}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}