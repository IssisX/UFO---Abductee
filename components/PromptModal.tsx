/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useEffect } from 'react';
import { Sparkles, X, Loader2, Wand2, Hammer, Cpu, Check, ChevronDown, Zap } from 'lucide-react';
import { AIModelId, AI_MODELS } from '../types';

interface PromptModalProps {
  isOpen: boolean;
  mode: 'create' | 'morph';
  selectedModel: AIModelId;
  onSelectModel: (modelId: AIModelId) => void;
  onClose: () => void;
  onSubmit: (prompt: string, isAnimated?: boolean) => Promise<void>;
}

export const PromptModal: React.FC<PromptModalProps> = ({ 
  isOpen, 
  mode, 
  selectedModel, 
  onSelectModel, 
  onClose, 
  onSubmit 
}) => {
  const [prompt, setPrompt] = useState('');
  const [isAnimated, setIsAnimated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setIsAnimated(false);
      setError('');
      setIsLoading(false);
      setIsModelDropdownOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentModelOption = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0];

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isLoading) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      await onSubmit(prompt, isAnimated);
      setPrompt('');
      onClose();
    } catch (err) {
      console.error(err);
      setError('The magic failed! Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isCreate = mode === 'create';
  const themeBg = isCreate ? 'bg-sky-500' : 'bg-amber-500';
  const themeHover = isCreate ? 'hover:bg-sky-600' : 'hover:bg-amber-600';
  const themeLight = isCreate ? 'bg-sky-100' : 'bg-amber-100';
  const themeText = isCreate ? 'text-sky-600' : 'text-amber-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 font-sans">
      <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col border-4 ${isCreate ? 'border-sky-100' : 'border-amber-100'} animate-in fade-in zoom-in duration-200 scale-95 sm:scale-100 overflow-hidden`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isCreate ? 'border-sky-50 bg-gradient-to-r from-sky-50 to-blue-50' : 'border-amber-50 bg-gradient-to-r from-amber-50 to-orange-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${themeLight} ${themeText}`}>
                {isCreate ? <Wand2 size={24} strokeWidth={2.5} /> : <Hammer size={24} strokeWidth={2.5} />}
            </div>
            <div>
                <h2 className="text-xl font-extrabold text-slate-800">
                    {isCreate ? 'New Build' : 'Rebuild blocks'}
                </h2>
                <p className={`text-xs font-bold uppercase tracking-wide ${isCreate ? 'text-sky-500' : 'text-amber-500'}`}>
                    POWERED BY {currentModelOption.displayName.toUpperCase()}
                </p>
            </div>
          </div>
          <button 
            onClick={!isLoading ? onClose : undefined}
            className="p-2 rounded-xl bg-white/50 text-slate-400 hover:bg-white hover:text-slate-700 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 bg-white">
          
          {/* AI Model Picker Banner */}
          <div className="mb-5 relative">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 block">
              Active AI Model
            </label>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-md shadow-indigo-200">
                  {currentModelOption.id === 'gemini-3.6-flash' ? <Zap size={18} /> : <Cpu size={18} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 text-sm">{currentModelOption.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                      {currentModelOption.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{currentModelOption.description}</p>
                </div>
              </div>
              <ChevronDown size={18} className={`text-slate-400 group-hover:text-slate-600 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Model Selector Dropdown */}
            {isModelDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border-2 border-slate-100 p-2 z-50 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                {AI_MODELS.map((model) => {
                  const isSelected = model.id === selectedModel;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        onSelectModel(model.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`
                        w-full flex items-start justify-between p-3 rounded-xl transition-all text-left
                        ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg mt-0.5 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {model.id === 'gemini-3.6-flash' ? <Zap size={16} /> : <Cpu size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-extrabold text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                              {model.name}
                            </span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {model.speed}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{model.description}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="text-indigo-600 p-1">
                          <Check size={18} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Animation Toggle Switch */}
          <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${isAnimated ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'} transition-colors`}>
                <Sparkles size={18} />
              </div>
              <div>
                <span className="font-extrabold text-slate-800 text-sm block">3D Animated Model</span>
                <span className="text-[11px] font-medium text-slate-500">Generate multi-frame 3D keyframe motion sequence</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAnimated(!isAnimated)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${isAnimated ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${isAnimated ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <p className="text-slate-600 font-semibold mb-2 text-sm">
            {isCreate 
                ? (isAnimated ? "What animated 3D creation should we build?" : "What new creation should we build?")
                : "How should we rebuild the current voxels?"}
          </p>

          {/* Quick Preset Chips for inspiration */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { label: '🦅 Flying Eagle', text: 'A Majestic Flying Eagle with flapping wings' },
              { label: '🐱 Walking Cat', text: 'A Cute Walking Cat moving its legs and tail' },
              { label: '💓 Pulsing Heart', text: 'A Glowing Pulsing Crystal Heart with orbiting embers' },
              { label: '🛸 Hovering UFO', text: 'A Hovering UFO with spinning LED perimeter lights' },
              { label: '🔥 Campfire', text: 'A Dancing Campfire with flickering flames and rising sparks' }
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPrompt(chip.text);
                  setIsAnimated(true);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 font-bold border border-slate-200 transition-all active:scale-95"
              >
                {chip.label}
              </button>
            ))}
          </div>
          
          <form onSubmit={handleSubmit}>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={isCreate 
                ? "e.g., A medieval castle, a giant robot, a fruit basket..." 
                : "e.g., Turn it into a car, make a pyramid, build a smiley face..."}
              disabled={isLoading}
              className={`w-full h-28 resize-none bg-slate-50 border-2 border-slate-200 rounded-xl p-4 font-medium text-slate-700 focus:outline-none focus:ring-4 transition-all placeholder:text-slate-400 mb-4 ${isCreate ? 'focus:border-sky-400 focus:ring-sky-100' : 'focus:border-amber-400 focus:ring-amber-100'}`}
              autoFocus
            />

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold flex items-center gap-2">
                <X size={16} /> {error}
              </div>
            )}

            <div className="flex justify-end">
              <button 
                type="submit"
                disabled={!prompt.trim() || isLoading}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm transition-all
                  ${isLoading 
                    ? 'bg-slate-200 text-slate-400 cursor-wait' 
                    : `${themeBg} ${themeHover} shadow-lg active:scale-95`}
                `}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating with {currentModelOption.displayName}...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} fill="currentColor" />
                    Generate ({currentModelOption.displayName})
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

