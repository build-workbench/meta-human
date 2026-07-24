const translations = {
  // Navbar
  'nav.features': '功能',
  'nav.tech': '技术',
  'nav.quickstart': '快速开始',
  'nav.tryNow': '立即体验',

  // Hero Section
  'hero.badge': '开源 3D 数字人引擎 v2.2',
  'hero.title': '让 AI 拥有',
  'hero.titleHighlight': '实时交互的数字身体',
  'hero.subtitle': '浏览器原生的 3D 数字人交互引擎，支持语音、对话能力。',
  'hero.subtitleHighlight': '零配置启动，离线可用，开源 MIT。',
  'hero.cta.try': '立即体验',
  'hero.highlight.config': '零配置启动',
  'hero.highlight.offline': '离线可用',
  'hero.highlight.quality': '开源 MIT',
  'hero.scrollHint': '向下滚动了解更多',
  'hero.stats.fps': '单元测试',
  'hero.stats.landmarks': 'gzip 体积',
  'hero.preview.title': 'MetaHuman Engine Preview',
  'hero.preview.placeholder': '输入消息与数字人互动...',
  'hero.preview.connected': '系统已连接',

  // Features Section
  'features.title': '核心功能',
  'features.subtitle': '全套数字人能力，开箱即用',

  'features.avatar.title': '3D 数字人引擎',
  'features.avatar.desc':
    '支持 GLB/GLTF 模型加载，提供情绪驱动的表情系统和骨骼动画，自适应性能调节。',

  'features.voice.title': '语音交互',
  'features.voice.desc':
    '基于浏览器原生 Web Speech API 实现语音合成（TTS）与语音识别（ASR），无需第三方服务。',

  'features.dialogue.title': '智能对话',
  'features.dialogue.desc': '多模态响应架构，支持流式输出和优雅降级，会话状态持久化管理。',

  // Tech Stack Section
  'tech.title': '技术架构',
  'tech.subtitle': '现代化技术栈，高性能保障',

  // CTA Section
  'cta.title': '开始构建你的数字人',
  'cta.subtitle': '几分钟即可拥有功能完整的 3D 交互体验',
  'cta.button': '开始体验',

  // Footer
  'footer.copyright': '© {{year}} LessUp. 保留所有权利。',

  // Settings Drawer
  'settings.character.title': '角色预设',
  'settings.character.desc': '切换数字人对话人设，下一轮对话生效。',
  'settings.config.title': 'API 端点',
  'settings.config.desc': '运行时覆盖后端地址（优先于 env 配置），刷新后仍生效。',
  'settings.config.baseUrl': '主端点 Base URL',
  'settings.config.fallbacks': '备用端点（逗号分隔）',
  'settings.config.apply': '应用',
  'settings.config.reset': '恢复 env 默认',
  'settings.config.saved': '已保存',
  'settings.config.current': '当前覆盖',
  'settings.avatar.title': '头像来源',
  'settings.avatar.desc': '上传 GLB/GLTF 模型。加载失败时自动回退到内置程序化头像。',
  'settings.avatar.current': '当前头像',
  'settings.avatar.builtin': '内置程序化头像',
  'settings.avatar.upload': '上传自定义头像',
  'settings.avatar.status': '状态',
  'settings.avatar.useBuiltin': '使用内置头像',
  'settings.avatar.statusReady': '已就绪',
  'settings.avatar.statusError': '加载失败，已回退',
  'settings.avatar.statusIdle': '等待加载',
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, replacements?: Record<string, string>): string {
  let text: string = translations[key];
  if (replacements) {
    for (const [placeholder, value] of Object.entries(replacements)) {
      text = text.replace(new RegExp(`{{${placeholder}}}`, 'g'), value);
    }
  }
  return text;
}
