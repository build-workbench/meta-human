/**
 * Logger utility that respects environment settings.
 * 生产环境通过 vite esbuild.pure 移除 debug/info/log，保留 warn/error。
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Only show debug logs in development（测试环境保持 info，避免用例输出噪音）
const MIN_LOG_LEVEL: LogLevel =
  import.meta.env.DEV && import.meta.env.MODE !== 'test' ? 'debug' : 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

function createLogger(context: string): Logger {
  const prefix = `[${context}]`;

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog('debug')) {
        console.debug(prefix, ...args);
      }
    },
    info: (...args: unknown[]) => {
      if (shouldLog('info')) {
        console.info(prefix, ...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (shouldLog('warn')) {
        console.warn(prefix, ...args);
      }
    },
    error: (...args: unknown[]) => {
      if (shouldLog('error')) {
        console.error(prefix, ...args);
      }
    },
  };
}

// Pre-configured loggers for different modules
export const loggers = {
  audio: createLogger('AudioService'),
  dialogue: createLogger('DialogueService'),
  orchestrator: createLogger('DialogueOrchestrator'),
  avatar: createLogger('DigitalHumanEngine'),
  chat: createLogger('ChatStream'),
  app: createLogger('App'),
} as const;

export default createLogger;
