import React, { useState } from 'react';
import { Palette, Eye, Smile, Frown, Meh, Laugh, Angry, Zap } from 'lucide-react';

interface ExpressionControl {
  name: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  intensity: number;
}

interface ExpressionControlPanelProps {
  currentExpression: string;
  onExpressionChange: (expression: string, intensity: number) => void;
}

export default function ExpressionControlPanel({
  currentExpression,
  onExpressionChange,
}: ExpressionControlPanelProps) {
  const [intensity, setIntensity] = useState(0.8);

  const expressions: ExpressionControl[] = [
    {
      name: 'neutral',
      label: '平静',
      icon: <Meh size={20} />,
      color: 'text-gray-400 light:text-zinc-600',
      intensity: 0.5,
    },
    {
      name: 'smile',
      label: '微笑',
      icon: <Smile size={20} />,
      color: 'text-green-400 light:text-green-600',
      intensity: 0.7,
    },
    {
      name: 'laugh',
      label: '大笑',
      icon: <Laugh size={20} />,
      color: 'text-yellow-400 light:text-yellow-600',
      intensity: 1.0,
    },
    {
      name: 'surprise',
      label: '惊讶',
      icon: <Zap size={20} />,
      color: 'text-orange-400',
      intensity: 0.8,
    },
    {
      name: 'sad',
      label: '悲伤',
      icon: <Frown size={20} />,
      color: 'text-blue-400 light:text-blue-600',
      intensity: 0.6,
    },
    {
      name: 'angry',
      label: '生气',
      icon: <Angry size={20} />,
      color: 'text-red-400 light:text-red-600',
      intensity: 0.9,
    },
    {
      name: 'blink',
      label: '眨眼',
      icon: <Eye size={20} />,
      color: 'text-purple-400 light:text-purple-600',
      intensity: 0.4,
    },
  ];

  const handleExpressionClick = (expressionName: string, defaultIntensity: number) => {
    setIntensity(defaultIntensity);
    onExpressionChange(expressionName, defaultIntensity);
  };

  const handleIntensityChange = (newIntensity: number) => {
    setIntensity(newIntensity);
    if (currentExpression) {
      onExpressionChange(currentExpression, newIntensity);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-white/10 light:border-zinc-900/10 pb-4">
        <h3 className="text-lg font-medium text-white light:text-zinc-900">表情控制</h3>
        <div className="flex items-center space-x-2 px-3 py-1 bg-white/5 light:bg-zinc-900/[0.04] rounded-full border border-white/5 light:border-zinc-900/5">
          <Palette size={14} className="text-white/60 light:text-zinc-600" />
          <span className="text-xs text-white/80 light:text-zinc-800 font-mono uppercase">
            {currentExpression || '平静'}
          </span>
        </div>
      </div>

      {/* 表情网格 */}
      <div className="grid grid-cols-2 gap-3">
        {expressions.map((expression) => (
          <button
            key={expression.name}
            onClick={() => handleExpressionClick(expression.name, expression.intensity)}
            aria-pressed={currentExpression === expression.name}
            className={`flex items-center space-x-3 p-3 rounded-xl border transition-all duration-200 group text-left ${
              currentExpression === expression.name
                ? 'border-blue-500/50 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                : 'border-white/5 light:border-zinc-900/5 bg-white/5 light:bg-zinc-900/[0.04] light:hover:bg-zinc-900/5 light:hover:border-zinc-900/20'
            }`}
          >
            <div
              className={`p-2 rounded-lg bg-black/20 light:bg-zinc-900/[0.03] ${expression.color}`}
            >
              {expression.icon}
            </div>
            <div>
              <div className="font-medium text-gray-200 light:text-zinc-800 text-sm">
                {expression.label}
              </div>
              <div className="text-[10px] text-white/40 light:text-zinc-500">
                强度: {Math.round(expression.intensity * 100)}%
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 强度滑杆 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white/40 light:text-zinc-500 uppercase tracking-wider">
            表情强度
          </label>
          <span className="text-xs font-mono text-blue-400 light:text-blue-600">
            {Math.round(intensity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={intensity}
          onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
          aria-label="表情强度"
          className="w-full h-1.5 bg-white/10 light:bg-zinc-900/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* 微表情触发 */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-white/40 light:text-zinc-500 uppercase tracking-wider">
          微表情
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {['挑眉', '快速眨眼', '张嘴', '点头'].map((action, i) => {
            const keys = ['eyebrow_raise', 'eye_blink', 'mouth_open', 'head_nod'];
            return (
              <button
                key={action}
                onClick={() => onExpressionChange(keys[i], intensity)}
                aria-label={action}
                className="px-3 py-2 bg-white/5 light:bg-zinc-900/[0.04] light:hover:bg-zinc-900/5 text-white/70 light:text-zinc-700 light:hover:text-zinc-900 border border-white/5 light:border-zinc-900/5 rounded-lg text-xs transition-colors"
              >
                {action}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-white/10 light:border-zinc-900/10">
        <button
          onClick={() => {
            onExpressionChange('neutral', 0.5);
            setIntensity(0.5);
          }}
          className="w-full px-4 py-2 bg-white/5 light:bg-zinc-900/[0.04] light:hover:bg-zinc-900/5 text-white/60 light:text-zinc-600 light:hover:text-zinc-900 rounded-lg transition-colors text-sm"
        >
          重置表情
        </button>
      </div>
    </div>
  );
}
