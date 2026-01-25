/**
 * 日志工具
 * 根据环境变量控制日志输出级别
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 从环境变量获取日志级别（开发环境默认 debug，生产环境默认 warn）
const getLogLevel = (): LogLevel => {
  if (typeof window === 'undefined') return 'warn';

  const env = import.meta.env.MODE || 'development';
  const level = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined;

  if (level) return level;

  // 默认级别：开发环境 debug，生产环境 warn
  return env === 'production' ? 'warn' : 'debug';
};

const currentLogLevel = getLogLevel();

// 日志级别优先级
const logLevelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const shouldLog = (level: LogLevel): boolean => {
  return logLevelPriority[level] >= logLevelPriority[currentLogLevel];
};

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.log(...args);
    }
  },

  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info(...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn(...args);
    }
  },

  error: (...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error(...args);
    }
  },

  // 兼容旧代码：直接使用 console.log
  log: (...args: unknown[]) => {
    logger.debug(...args);
  },
};
