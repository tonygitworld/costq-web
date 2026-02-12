// utils/performance.ts - 首屏性能优化工具库

/**
 * ★ P1: 首屏数据加载优化 - 优先级队列
 *
 * 问题：ChatLayout 同时发起 AWS/GCP 账号请求，造成网络拥塞
 * 解决：按优先级分批加载，首屏只加载关键数据
 */

// 任务优先级
export enum LoadPriority {
  CRITICAL = 1,  // 首屏必需，立即加载
  HIGH = 2,      // 首屏后尽快加载
  NORMAL = 3,    // 空闲时加载
  LOW = 4,       // 延迟加载
}

interface LoadTask<T> {
  id: string;
  priority: LoadPriority;
  loader: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retries: number;
}

// ★ P1: 优先级加载队列
class PriorityLoader {
  private queue: LoadTask<unknown>[] = [];
  private running = false;
  private maxConcurrent = 2; // 最大并发数

  // 添加任务到队列
  add<T>(id: string, priority: LoadPriority, loader: () => Promise<T>, retries = 1): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: LoadTask<T> = {
        id,
        priority,
        loader,
        resolve: resolve as (value: unknown) => void,
        reject: reject as (error: Error) => void,
        retries,
      };

      this.queue.push(task as LoadTask<unknown>);
      this.queue.sort((a, b) => a.priority - b.priority);

      this.process();
    });
  }

  // 处理队列
  private async process() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const runningCount = this.queue.filter(t => t.priority === LoadPriority.CRITICAL).length;
      const availableSlots = this.maxConcurrent - runningCount;

      if (availableSlots <= 0) {
        await this.delay(50);
        continue;
      }

      const task = this.queue.shift();
      if (!task) continue;

      this.execute(task);
    }

    this.running = false;
  }

  // 执行任务
  private async execute(task: LoadTask<unknown>) {
    try {
      const result = await task.loader();
      task.resolve(result);
    } catch (error) {
      if (task.retries > 0) {
        task.retries--;
        this.queue.push(task);
        this.queue.sort((a, b) => a.priority - b.priority);
      } else {
        task.reject(error as Error);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const priorityLoader = new PriorityLoader();

/**
 * ★ P1: 空闲时加载（requestIdleCallback 封装）
 */
export const loadWhenIdle = <T>(loader: () => Promise<T>, timeout = 2000): Promise<T> => {
  return new Promise((resolve, reject) => {
    const execute = () => {
      loader().then(resolve).catch(reject);
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(execute, { timeout });
    } else {
      setTimeout(execute, Math.min(timeout, 1000));
    }
  });
};

/**
 * ★ P1: 可见性感知加载
 * 页面可见时才加载数据
 */
export const loadWhenVisible = <T>(loader: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    if (!document.hidden) {
      loader().then(resolve).catch(reject);
      return;
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        loader().then(resolve).catch(reject);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
  });
};

/**
 * ★ P1: 渐进式加载 hook
 */
export interface ProgressiveLoadOptions {
  critical?: () => Promise<unknown>;
  high?: () => Promise<unknown>;
  normal?: () => Promise<unknown>;
  low?: () => Promise<unknown>;
}

export const useProgressiveLoad = (options: ProgressiveLoadOptions) => {
  const load = async () => {
    // 1. 关键数据立即加载
    if (options.critical) {
      await options.critical();
    }

    // 2. 高优先级数据尽快加载
    if (options.high) {
      Promise.resolve().then(options.high);
    }

    // 3. 普通数据空闲时加载
    if (options.normal) {
      loadWhenIdle(options.normal);
    }

    // 4. 低优先级数据延迟加载
    if (options.low) {
      setTimeout(options.low, 5000);
    }
  };

  return { load };
};

/**
 * ★ P1: 资源预加载（低优先级）
 */
export const preloadResource = (href: string, as: 'script' | 'style' | 'image' | 'font') => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;

  if (as === 'font') {
    link.crossOrigin = 'anonymous';
  }

  // 延迟添加到 DOM，避免阻塞首屏
  setTimeout(() => {
    document.head.appendChild(link);
  }, 100);
};

/**
 * ★ P1: 性能指标收集
 */
export const observePerformance = () => {
  // LCP
  if ('PerformanceObserver' in window) {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('[Performance] LCP:', lastEntry.startTime);
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // FID
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const fidEntry = entry as PerformanceEventTiming;
        console.log('[Performance] FID:', fidEntry.processingStart - fidEntry.startTime);
      }
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // CLS
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      console.log('[Performance] CLS:', clsValue);
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  }
};
