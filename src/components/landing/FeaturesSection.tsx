import { Box, Mic, Brain, Cpu, ArrowRight } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      icon: Box,
      title: '3D 数字人引擎',
      description: '支持 GLB/GLTF 模型加载，提供情绪驱动的表情系统和骨骼动画，自适应性能调节。',
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    {
      icon: Mic,
      title: '语音交互',
      description:
        '基于浏览器原生 Web Speech API 实现语音合成（TTS）与语音识别（ASR），无需第三方服务。',
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
    },
    {
      icon: Brain,
      title: '智能对话',
      description: '多模态响应架构，支持流式输出和优雅降级，会话状态持久化管理。',
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      icon: Cpu,
      title: '零配置部署',
      description:
        '开箱即用的开发体验，默认回退到本地 Mock 模式无需 API Key。前端可直接部署到 GitHub Pages；如需后端，可按需接入 `examples/backend-python/` 参考实现。',
      color: 'from-indigo-500 to-violet-500',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
    },
  ];

  const stats = [
    { value: '183', label: '单元测试用例' },
    { value: '~240KB', label: 'gzip 打包体积' },
    { value: '2', label: '传输协议 (HTTP/SSE)' },
    { value: '0 配置', label: '开箱即用' },
  ];

  return (
    <section id="features" className="relative overflow-hidden py-24 bg-black">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0a0f] to-black" />

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="landing-shell relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">核心功能</h2>
          <p className="text-lg text-gray-400">
            从 3D 渲染到智能对话，从语音交互到视觉感知，
            <br className="hidden sm:block" />
            一站式构建你的数字人应用
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group relative flex flex-col rounded-2xl border p-6 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${feature.borderColor} ${feature.bgColor}`}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} p-0.5 mb-4`}>
                <div className="w-full h-full rounded-xl bg-black/80 flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-gray-400">{feature.description}</p>

              {/* Learn More Link */}
              <div className="mt-4 flex items-center gap-1 text-sm text-gray-500 group-hover:text-white transition-colors">
                <span>了解更多</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>

              {/* Hover Glow Effect */}
              <div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`}
              />
            </div>
          ))}
        </div>

        {/* Bottom Stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
