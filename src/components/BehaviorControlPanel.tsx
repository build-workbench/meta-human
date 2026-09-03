import { useMemo, useState } from 'react';
import { Activity, Brain, Zap, Target, Clock, TrendingUp } from 'lucide-react';

interface BehaviorState {
  state: string;
  confidence: number;
  lastUpdate: Date;
  activity: string;
  goal: string;
}

type BehaviorParameters = Record<string, unknown>;

interface BehaviorControlPanelProps {
  currentBehavior: string;
  onBehaviorChange: (behavior: string, parameters: BehaviorParameters) => void;
}

export default function BehaviorControlPanel({
  currentBehavior,
  onBehaviorChange,
}: BehaviorControlPanelProps) {
  const [behaviorState, setBehaviorState] = useState<BehaviorState>({
    state: 'idle',
    confidence: 0.8,
    lastUpdate: new Date(),
    activity: '待机',
    goal: '等待输入',
  });

  const behaviors = useMemo(
    () => [
      {
        name: 'idle',
        label: '待机',
        icon: <Clock size={20} />,
        color: 'text-gray-400 light:text-zinc-600',
        description: '基础待机循环',
        parameters: { idleTime: 5000, breathing: true },
      },
      {
        name: 'greeting',
        label: '问候',
        icon: <Target size={20} />,
        color: 'text-green-400 light:text-green-600',
        description: '友好挥手与微笑',
        parameters: { wave: true, smile: true, duration: 3000 },
      },
      {
        name: 'listening',
        label: '聆听',
        icon: <Brain size={20} />,
        color: 'text-blue-400 light:text-blue-600',
        description: '主动专注倾听',
        parameters: { headNod: true, eyeContact: true, attention: 0.9 },
      },
      {
        name: 'thinking',
        label: '思考',
        icon: <Activity size={20} />,
        color: 'text-yellow-400 light:text-yellow-600',
        description: '处理中动画',
        parameters: { headTilt: true, pause: true, processing: true },
      },
      {
        name: 'speaking',
        label: '说话',
        icon: <TrendingUp size={20} />,
        color: 'text-purple-400 light:text-purple-600',
        description: '正在对话',
        parameters: { mouthMove: true, gestures: true, emphasis: 0.8 },
      },
      {
        name: 'excited',
        label: '兴奋',
        icon: <Zap size={20} />,
        color: 'text-orange-400',
        description: '高能量状态',
        parameters: { energy: 0.9, movement: true, animation: 'bounce' },
      },
    ],
    [],
  );

  const handleBehaviorClick = (behaviorName: string, parameters: BehaviorParameters) => {
    const behavior = behaviors.find((b) => b.name === behaviorName);
    if (!behavior) return;

    setBehaviorState({
      state: behaviorName,
      confidence: 0.9,
      lastUpdate: new Date(),
      activity: behavior.label,
      goal: `手动切换：${behavior.label}`,
    });

    onBehaviorChange(behaviorName, parameters);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 light:border-zinc-900/10 pb-4">
        <h3 className="text-lg font-medium text-white light:text-zinc-900">行为引擎</h3>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20 light:bg-zinc-900/15 light:bg-zinc-900/15"></div>
          <span className="text-xs text-white/60 light:text-zinc-600">手动控制</span>
        </div>
      </div>

      {/* 状态监控 */}
      <div className="bg-black/40 light:bg-zinc-900/[0.04] rounded-xl p-4 space-y-2 border border-white/5 light:border-zinc-900/5 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-white/40 light:text-zinc-500">状态</span>
          <span className="text-green-400 light:text-green-600 uppercase">
            {behaviorState.state}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40 light:text-zinc-500">置信度</span>
          <span className="text-blue-400 light:text-blue-600">
            {Math.round(behaviorState.confidence * 100)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40 light:text-zinc-500">目标</span>
          <span className="text-white/60 light:text-zinc-600 truncate max-w-[150px] text-right">
            {behaviorState.goal}
          </span>
        </div>
      </div>

      {/* 行为网格 */}
      <div className="grid grid-cols-2 gap-3">
        {behaviors.map((behavior) => (
          <button
            key={behavior.name}
            onClick={() => handleBehaviorClick(behavior.name, behavior.parameters)}
            aria-pressed={currentBehavior === behavior.name}
            className={`flex items-center space-x-3 p-3 rounded-xl border transition-all text-left ${
              currentBehavior === behavior.name
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-white/5 light:border-zinc-900/5 bg-white/5 light:bg-zinc-900/[0.04] light:hover:bg-zinc-900/5'
            }`}
          >
            <div
              className={`p-2 rounded-lg bg-black/20 light:bg-zinc-900/[0.03] ${behavior.color}`}
            >
              {behavior.icon}
            </div>
            <div>
              <div className="font-medium text-gray-200 light:text-zinc-800 text-sm">
                {behavior.label}
              </div>
              <div className="text-[10px] text-white/40 light:text-zinc-500">
                {behavior.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
