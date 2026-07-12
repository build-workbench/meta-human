/**
 * 轻量级国际化工具
 * 支持中英文自动检测和切换
 *
 * 语言优先级：URL参数 > localStorage > 浏览器语言
 * 格式：?lang=zh 或 ?lang=en
 */

export type Language = 'zh-CN' | 'en';

// 有效的语言列表
export const VALID_LANGUAGES: Language[] = ['zh-CN', 'en'];

// 语言验证辅助函数
export function isValidLanguage(lang: string): lang is Language {
  return VALID_LANGUAGES.includes(lang as Language);
}

// 语言包定义
const translations = {
  'zh-CN': {
    // Navbar
    'nav.features': '功能',
    'nav.tech': '技术',
    'nav.quickstart': '快速开始',
    'nav.docs': '文档',
    'nav.tryNow': '立即体验',

    // Language switch
    'lang.zh': '中文',
    'lang.en': 'English',

    // Hero Section
    'hero.badge': '开源 3D 数字人引擎 v2.2',
    'hero.title': '让 AI 拥有',
    'hero.titleHighlight': '实时交互的数字身体',
    'hero.subtitle': '浏览器原生的 3D 数字人交互引擎，支持语音、对话能力。',
    'hero.subtitleHighlight': '零配置启动，离线可用，开源 MIT。',
    'hero.cta.try': '立即体验',
    'hero.cta.docs': '查看文档',
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
    'features.avatar.feature1': '自定义模型或程序化形象',
    'features.avatar.feature2': '情绪驱动表情自动映射',
    'features.avatar.feature3': '对话触发的骨骼动画',

    'features.voice.title': '语音交互',
    'features.voice.desc':
      '基于浏览器原生 Web Speech API 实现语音合成（TTS）与语音识别（ASR），无需第三方服务。',
    'features.voice.feature1': 'SpeechSynthesis 语音合成',
    'features.voice.feature2': 'SpeechRecognition 语音识别',
    'features.voice.feature3': '用户说话时自动静音',

    'features.dialogue.title': '智能对话',
    'features.dialogue.desc': '多模态响应架构，支持流式输出和优雅降级，会话状态持久化管理。',
    'features.dialogue.feature1': '多模态响应（文本+情绪+动作）',
    'features.dialogue.feature2': 'SSE 流式实时响应',
    'features.dialogue.feature3': '自动降级到本地 Mock',

    // Tech Stack Section
    'tech.title': '技术架构',
    'tech.subtitle': '现代化技术栈，高性能保障',

    'tech.react.title': 'React 19',
    'tech.react.desc': '最新 React 特性，并发渲染优化',

    'tech.three.title': 'Three.js',
    'tech.three.desc': 'WebGL 3D 渲染，性能卓越',

    'tech.tailwind.title': 'Tailwind CSS',
    'tech.tailwind.desc': '原子化样式，快速开发',

    'tech.vite.title': 'Vite',
    'tech.vite.desc': '极速构建，开发体验优秀',

    'tech.zustand.title': 'Zustand',
    'tech.zustand.desc': '轻量状态管理，简洁高效',

    // CTA Section
    'cta.title': '开始构建你的数字人',
    'cta.subtitle': '几分钟即可拥有功能完整的 3D 交互体验',
    'cta.button': '开始体验',

    // Footer
    'footer.product': '产品',
    'footer.product.features': '功能',
    'footer.product.tech': '技术架构',
    'footer.product.demo': '在线演示',
    'footer.resources': '资源',
    'footer.resources.docs': '文档',
    'footer.resources.api': 'API',
    'footer.resources.github': 'GitHub',
    'footer.community': '社区',
    'footer.copyright': '© {{year}} LessUp. 保留所有权利。',
    'footer.license': 'MIT 许可证',

    // Meta
    'meta.title': 'MetaHuman Engine - 开源 3D 数字人交互引擎',
    'meta.description':
      'MetaHuman Engine - 浏览器原生的 3D 数字人引擎，集成语音、对话能力。零配置，离线可用，开源 MIT。',
    'meta.keywords':
      'digital human, 3D avatar, AI, voice interaction, WebGL, Three.js, React, TypeScript, 数字人, 3D形象, 人工智能, 语音交互',

    // Settings Drawer (new sections)
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

    // Settings Drawer — Avatar tab
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
  },
  en: {
    // Navbar
    'nav.features': 'Features',
    'nav.tech': 'Tech',
    'nav.quickstart': 'Quick Start',
    'nav.docs': 'Docs',
    'nav.tryNow': 'Try Now',

    // Language switch
    'lang.zh': '中文',
    'lang.en': 'English',

    // Hero Section
    'hero.badge': 'Open Source 3D Digital Human Engine v2.2',
    'hero.title': 'Give AI a',
    'hero.titleHighlight': 'Real-time Interactive Digital Body',
    'hero.subtitle': 'Browser-native 3D digital human engine with voice and dialogue capabilities.',
    'hero.subtitleHighlight': 'Zero-config, offline-ready, open-source MIT.',
    'hero.cta.try': 'Try Now',
    'hero.cta.docs': 'Documentation',
    'hero.highlight.config': 'Zero Config',
    'hero.highlight.offline': 'Offline Ready',
    'hero.highlight.quality': 'Open Source MIT',
    'hero.scrollHint': 'Scroll down for more',
    'hero.stats.fps': 'Unit Tests',
    'hero.stats.landmarks': 'gzip Bundle',
    'hero.preview.title': 'MetaHuman Engine Preview',
    'hero.preview.placeholder': 'Type to interact with the digital human...',
    'hero.preview.connected': 'System Connected',

    // Features Section
    'features.title': 'Core Features',
    'features.subtitle': 'Complete digital human capabilities out of the box',

    'features.avatar.title': '3D Avatar Engine',
    'features.avatar.desc':
      'Support for GLB/GLTF models with emotion-driven expression system and skeletal animation, adaptive performance scaling.',
    'features.avatar.feature1': 'Custom models or procedural avatars',
    'features.avatar.feature2': 'Emotion-driven expression mapping',
    'features.avatar.feature3': 'Dialogue-triggered animations',

    'features.voice.title': 'Voice Interaction',
    'features.voice.desc':
      'Browser-native Web Speech API for both speech synthesis (TTS) and speech recognition (ASR), no third-party service required.',
    'features.voice.feature1': 'SpeechSynthesis voice output',
    'features.voice.feature2': 'SpeechRecognition voice input',
    'features.voice.feature3': 'Auto-mute when user speaks',

    'features.dialogue.title': 'Intelligent Dialogue',
    'features.dialogue.desc':
      'Multi-modal response architecture supporting streaming output and graceful degradation with persistent session management.',
    'features.dialogue.feature1': 'Multi-modal responses (text+emotion+action)',
    'features.dialogue.feature2': 'SSE streaming real-time responses',
    'features.dialogue.feature3': 'Automatic fallback to local mock',

    // Tech Stack Section
    'tech.title': 'Tech Stack',
    'tech.subtitle': 'Modern technology stack, high performance guaranteed',

    'tech.react.title': 'React 19',
    'tech.react.desc': 'Latest React features with concurrent rendering',

    'tech.three.title': 'Three.js',
    'tech.three.desc': 'WebGL 3D rendering with excellent performance',

    'tech.tailwind.title': 'Tailwind CSS',
    'tech.tailwind.desc': 'Atomic styling for rapid development',

    'tech.vite.title': 'Vite',
    'tech.vite.desc': 'Lightning fast builds, great DX',

    'tech.zustand.title': 'Zustand',
    'tech.zustand.desc': 'Lightweight state management',

    // CTA Section
    'cta.title': 'Start Building Your Digital Human',
    'cta.subtitle': 'Get a fully functional 3D interaction experience in minutes',
    'cta.button': 'Get Started',

    // Footer
    'footer.product': 'Product',
    'footer.product.features': 'Features',
    'footer.product.tech': 'Technology',
    'footer.product.demo': 'Live Demo',
    'footer.resources': 'Resources',
    'footer.resources.docs': 'Documentation',
    'footer.resources.api': 'API',
    'footer.resources.github': 'GitHub',
    'footer.community': 'Community',
    'footer.copyright': '© {{year}} LessUp. All rights reserved.',
    'footer.license': 'MIT License',

    // Meta
    'meta.title': 'MetaHuman Engine - Open Source 3D Digital Human Engine',
    'meta.description':
      'MetaHuman Engine - Browser-native 3D digital human engine with voice and dialogue capabilities. Zero-config, offline-ready, open-source MIT.',
    'meta.keywords':
      'digital human, 3D avatar, AI, voice interaction, WebGL, Three.js, React, TypeScript',

    // Settings Drawer (new sections)
    'settings.character.title': 'Character Presets',
    'settings.character.desc':
      'Switch the digital human persona; applies on the next dialogue turn.',
    'settings.config.title': 'API Endpoint',
    'settings.config.desc':
      'Override the backend URL at runtime (takes precedence over env config); persists across reloads.',
    'settings.config.baseUrl': 'Primary Base URL',
    'settings.config.fallbacks': 'Fallback endpoints (comma-separated)',
    'settings.config.apply': 'Apply',
    'settings.config.reset': 'Reset to env default',
    'settings.config.saved': 'Saved',
    'settings.config.current': 'Current override',

    // Settings Drawer — Avatar tab
    'settings.avatar.title': 'Avatar Source',
    'settings.avatar.desc':
      'Upload a GLB/GLTF avatar. If loading fails, the built-in procedural avatar stays available.',
    'settings.avatar.current': 'Current avatar',
    'settings.avatar.builtin': 'Built-in procedural avatar',
    'settings.avatar.upload': 'Upload custom avatar',
    'settings.avatar.status': 'Status',
    'settings.avatar.useBuiltin': 'Use built-in avatar',
    'settings.avatar.statusReady': 'Ready',
    'settings.avatar.statusError': 'Load failed, fell back',
    'settings.avatar.statusIdle': 'Waiting to load',
  },
};

// 获取当前语言
// 优先级：URL 参数 > localStorage > 浏览器语言
export function getCurrentLanguage(): Language {
  // 1. URL 参数（最高优先级，允许显式覆盖）
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get('lang');
  if (urlLang === 'en') return 'en';
  if (urlLang === 'zh') return 'zh-CN';

  // 2. localStorage（用户偏好）
  try {
    const stored = localStorage.getItem('preferred-lang') as Language | null;
    if (stored === 'en' || stored === 'zh-CN') return stored;
  } catch {
    // Ignore storage read failures
  }

  // 3. 浏览器语言
  const browserLang = navigator.language || '';
  if (browserLang.startsWith('zh')) return 'zh-CN';

  // 4. 默认中文
  return 'zh-CN';
}

// 设置语言
export function setLanguage(lang: Language): void {
  try {
    localStorage.setItem('preferred-lang', lang);
  } catch {
    // Ignore storage write failures
  }
  document.documentElement.lang = lang;
  document.documentElement.setAttribute('data-lang', lang);

  // 更新 URL 参数（不刷新页面）
  const params = new URLSearchParams(window.location.search);
  if (lang === 'en') {
    params.set('lang', 'en');
  } else {
    params.set('lang', 'zh');
  }

  const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState({}, '', newUrl);

  // 触发语言变更事件
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));

  // 更新页面元数据
  updatePageMeta(lang);
}

// 切换语言
export function toggleLanguage(): Language {
  const current = getCurrentLanguage();
  const next = current === 'zh-CN' ? 'en' : 'zh-CN';
  setLanguage(next);
  return next;
}

// 翻译函数
export function t(key: string, replacements?: Record<string, string>): string {
  const lang = getCurrentLanguage();
  const messages = translations[lang];
  let text = messages[key as keyof typeof messages] || key;

  // 替换占位符
  if (replacements) {
    Object.entries(replacements).forEach(([placeholder, value]) => {
      text = text.replace(new RegExp(`{{${placeholder}}}`, 'g'), value);
    });
  }

  return text;
}

// 更新页面元数据
function updatePageMeta(lang: Language): void {
  const messages = translations[lang];

  // 更新 title
  const title = document.querySelector('title[data-i18n-meta="title"]') as HTMLTitleElement | null;
  if (title && messages['meta.title']) {
    title.textContent = messages['meta.title'];
  }

  // 更新 meta description
  const desc = document.querySelector(
    'meta[data-i18n-meta="description"]',
  ) as HTMLMetaElement | null;
  if (desc && messages['meta.description']) {
    desc.content = messages['meta.description'];
  }

  // 更新 meta keywords
  const keywords = document.querySelector(
    'meta[data-i18n-meta="keywords"]',
  ) as HTMLMetaElement | null;
  if (keywords && messages['meta.keywords']) {
    keywords.content = messages['meta.keywords'];
  }

  // 更新 og:title
  const ogTitle = document.querySelector(
    'meta[data-i18n-meta="og:title"]',
  ) as HTMLMetaElement | null;
  if (ogTitle && messages['meta.title']) {
    ogTitle.content = messages['meta.title'];
  }

  // 更新 og:description
  const ogDesc = document.querySelector(
    'meta[data-i18n-meta="og:description"]',
  ) as HTMLMetaElement | null;
  if (ogDesc && messages['meta.description']) {
    ogDesc.content = messages['meta.description'];
  }

  // 更新 og:locale
  const ogLocale = document.querySelector('meta[property="og:locale"]') as HTMLMetaElement | null;
  if (ogLocale) {
    ogLocale.content = lang === 'zh-CN' ? 'zh_CN' : 'en_US';
  }
}

// Hook 用的类型定义
export type UseI18nReturn = {
  lang: Language;
  t: (key: string, replacements?: Record<string, string>) => string;
  setLang: (lang: Language) => void;
  toggleLang: () => Language;
};
