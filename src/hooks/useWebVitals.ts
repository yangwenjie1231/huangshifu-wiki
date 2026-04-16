import { useEffect, useRef } from 'react';
import type { WebVitalsMetrics, WebVitalsInitOptions } from '../utils/webVitals';

export type { WebVitalsMetrics };

/**
 * 性能指标上报选项（Hook 版本）
 */
export interface WebVitalsOptions extends WebVitalsInitOptions {}

/**
 * 检查是否支持 Performance Observer
 */
const isPerformanceObserverSupported = (): boolean => {
  return typeof window !== 'undefined' && 'PerformanceObserver' in window;
};

/**
 * 检查是否支持 Performance API
 */
const isPerformanceSupported = (): boolean => {
  return typeof window !== 'undefined' && 'performance' in window;
};

/**
 * 获取 CLS 值
 * CLS 是累积值，需要持续跟踪
 */
const observeCLS = (callback: (value: number) => void): (() => void) => {
  if (!isPerformanceObserverSupported()) {
    return () => {};
  }

  let clsValue = 0;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // 只计算没有最近用户输入的布局偏移
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
      }
    }
    callback(clsValue);
  });

  try {
    observer.observe({ type: 'layout-shift', buffered: true } as any);
  } catch {
    // 降级处理：某些浏览器可能不支持 buffered 选项
    try {
      observer.observe({ entryTypes: ['layout-shift'] });
    } catch {
      return () => {};
    }
  }

  return () => observer.disconnect();
};

/**
 * 获取 LCP 值
 */
const observeLCP = (callback: (value: number) => void): (() => void) => {
  if (!isPerformanceObserverSupported()) {
    return () => {};
  }

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    // 取最后一个 LCP 条目（通常是最大的）
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      callback(lastEntry.startTime);
    }
  });

  try {
    observer.observe({ type: 'largest-contentful-paint', buffered: true } as any);
  } catch {
    try {
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch {
      return () => {};
    }
  }

  return () => observer.disconnect();
};

/**
 * 获取 FID 值
 */
const observeFID = (callback: (value: number) => void): (() => void) => {
  if (!isPerformanceObserverSupported()) {
    return () => {};
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // FID = 处理开始时间 - 事件开始时间
      const delay = (entry as any).processingStart - entry.startTime;
      callback(delay);
    }
  });

  try {
    observer.observe({ type: 'first-input', buffered: true } as any);
  } catch {
    try {
      observer.observe({ entryTypes: ['first-input'] });
    } catch {
      return () => {};
    }
  }

  return () => observer.disconnect();
};

/**
 * 获取 FCP 值
 */
const observeFCP = (callback: (value: number) => void): (() => void) => {
  if (!isPerformanceObserverSupported()) {
    return () => {};
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        callback(entry.startTime);
      }
    }
  });

  try {
    observer.observe({ type: 'paint', buffered: true } as any);
  } catch {
    try {
      observer.observe({ entryTypes: ['paint'] });
    } catch {
      return () => {};
    }
  }

  return () => observer.disconnect();
};

/**
 * 获取 TTFB 值
 */
const getTTFB = (callback: (value: number) => void): void => {
  if (!isPerformanceSupported()) {
    return;
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (navigation) {
    callback(navigation.responseStart - navigation.startTime);
  }
};

/**
 * 获取 INP (Interaction to Next Paint) 值
 * INP 是 FID 的替代指标，反映整体交互响应性
 */
const observeINP = (callback: (value: number) => void): (() => void) => {
  if (!isPerformanceObserverSupported()) {
    return () => {};
  }

  let maxDuration = 0;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // 只考虑事件类型的条目
      if ((entry as any).interactionId) {
        const duration = entry.duration;
        if (duration > maxDuration) {
          maxDuration = duration;
          callback(maxDuration);
        }
      }
    }
  });

  try {
    observer.observe({ type: 'event', buffered: true, durationThreshold: 0 } as any);
  } catch {
    try {
      observer.observe({ entryTypes: ['event'] });
    } catch {
      return () => {};
    }
  }

  return () => observer.disconnect();
};

/**
 * 上报性能指标
 */
const reportMetrics = (
  metrics: WebVitalsMetrics,
  options: WebVitalsOptions
): void => {
  const { logToConsole, reportToEndpoint, endpointUrl, onReport, sampleRate = 1 } = options;

  // 采样率控制
  if (Math.random() > sampleRate) {
    return;
  }

  // 控制台输出
  if (logToConsole) {
    console.group('[Web Vitals] 性能指标报告');
    if (metrics.lcp !== undefined) {
      const rating = metrics.lcp < 2500 ? '✅ 良好' : metrics.lcp < 4000 ? '⚠️ 需改进' : '❌ 差';
      console.log(`LCP (最大内容绘制): ${metrics.lcp.toFixed(2)}ms ${rating}`);
    }
    if (metrics.fid !== undefined) {
      const rating = metrics.fid < 100 ? '✅ 良好' : metrics.fid < 300 ? '⚠️ 需改进' : '❌ 差';
      console.log(`FID (首次输入延迟): ${metrics.fid.toFixed(2)}ms ${rating}`);
    }
    if (metrics.cls !== undefined) {
      const rating = metrics.cls < 0.1 ? '✅ 良好' : metrics.cls < 0.25 ? '⚠️ 需改进' : '❌ 差';
      console.log(`CLS (累积布局偏移): ${metrics.cls.toFixed(4)} ${rating}`);
    }
    if (metrics.fcp !== undefined) {
      const rating = metrics.fcp < 1800 ? '✅ 良好' : metrics.fcp < 3000 ? '⚠️ 需改进' : '❌ 差';
      console.log(`FCP (首次内容绘制): ${metrics.fcp.toFixed(2)}ms ${rating}`);
    }
    if (metrics.ttfb !== undefined) {
      const rating = metrics.ttfb < 800 ? '✅ 良好' : metrics.ttfb < 1800 ? '⚠️ 需改进' : '❌ 差';
      console.log(`TTFB (首字节时间): ${metrics.ttfb.toFixed(2)}ms ${rating}`);
    }
    if (metrics.inp !== undefined) {
      const rating = metrics.inp < 200 ? '✅ 良好' : metrics.inp < 500 ? '⚠️ 需改进' : '❌ 差';
      console.log(`INP (交互到下一次绘制): ${metrics.inp.toFixed(2)}ms ${rating}`);
    }
    console.groupEnd();
  }

  // 自定义回调
  if (onReport) {
    onReport(metrics);
  }

  // 上报到端点
  if (reportToEndpoint && endpointUrl) {
    // 使用 sendBeacon 确保数据在页面卸载时也能发送
    const data = JSON.stringify({
      metrics,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpointUrl, new Blob([data], { type: 'application/json' }));
    } else {
      fetch(endpointUrl, {
        method: 'POST',
        body: data,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {
        // 静默处理上报失败
      });
    }
  }
};

/**
 * Web Vitals 性能监控 Hook
 *
 * 自动收集 Core Web Vitals 指标：
 * - LCP: Largest Contentful Paint (最大内容绘制)
 * - FID: First Input Delay (首次输入延迟)
 * - CLS: Cumulative Layout Shift (累积布局偏移)
 * - FCP: First Contentful Paint (首次内容绘制)
 * - TTFB: Time to First Byte (首字节时间)
 * - INP: Interaction to Next Paint (交互到下一次绘制)
 *
 * @example
 * ```tsx
 * // 基础用法（仅控制台输出）
 * useWebVitals();
 *
 * // 自定义配置
 * useWebVitals({
 *   logToConsole: true,
 *   reportToEndpoint: true,
 *   endpointUrl: '/api/analytics/web-vitals',
 *   sampleRate: 0.5, // 50% 采样
 * });
 *
 * // 使用自定义回调
 * useWebVitals({
 *   onReport: (metrics) => {
 *     // 发送到自定义分析服务
 *     analytics.track('web_vitals', metrics);
 *   },
 * });
 * ```
 */
export const useWebVitals = (options: WebVitalsOptions = {}): void => {
  const metricsRef = useRef<WebVitalsMetrics>({});
  const reportedRef = useRef<Set<string>>(new Set());

  // 默认在开发环境输出到控制台
  const isDev = import.meta.env.DEV;
  const mergedOptions: WebVitalsOptions = {
    logToConsole: isDev,
    reportToEndpoint: false,
    sampleRate: 1,
    ...options,
  };

  useEffect(() => {
    // 检查浏览器支持
    if (typeof window === 'undefined') {
      return;
    }

    const cleanupFns: (() => void)[] = [];

    // 收集 LCP
    const cleanupLCP = observeLCP((value) => {
      metricsRef.current.lcp = value;
      if (!reportedRef.current.has('lcp')) {
        reportedRef.current.add('lcp');
        reportMetrics({ lcp: value }, mergedOptions);
      }
    });
    cleanupFns.push(cleanupLCP);

    // 收集 FID
    const cleanupFID = observeFID((value) => {
      metricsRef.current.fid = value;
      if (!reportedRef.current.has('fid')) {
        reportedRef.current.add('fid');
        reportMetrics({ fid: value }, mergedOptions);
      }
    });
    cleanupFns.push(cleanupFID);

    // 收集 CLS
    const cleanupCLS = observeCLS((value) => {
      metricsRef.current.cls = value;
      // CLS 会持续更新，只在页面隐藏时报告
      if (document.visibilityState === 'hidden' && !reportedRef.current.has('cls')) {
        reportedRef.current.add('cls');
        reportMetrics({ cls: value }, mergedOptions);
      }
    });
    cleanupFns.push(cleanupCLS);

    // 收集 FCP
    const cleanupFCP = observeFCP((value) => {
      metricsRef.current.fcp = value;
      if (!reportedRef.current.has('fcp')) {
        reportedRef.current.add('fcp');
        reportMetrics({ fcp: value }, mergedOptions);
      }
    });
    cleanupFns.push(cleanupFCP);

    // 收集 TTFB
    getTTFB((value) => {
      metricsRef.current.ttfb = value;
      if (!reportedRef.current.has('ttfb')) {
        reportedRef.current.add('ttfb');
        reportMetrics({ ttfb: value }, mergedOptions);
      }
    });

    // 收集 INP (如果支持)
    const cleanupINP = observeINP((value) => {
      metricsRef.current.inp = value;
      // INP 会持续更新，报告最新值
      reportMetrics({ inp: value }, mergedOptions);
    });
    cleanupFns.push(cleanupINP);

    // 页面卸载时报告最终的 CLS
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && metricsRef.current.cls !== undefined) {
        reportMetrics({ cls: metricsRef.current.cls }, mergedOptions);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 清理函数
    return () => {
      cleanupFns.forEach((fn) => fn());
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mergedOptions.logToConsole, mergedOptions.reportToEndpoint, mergedOptions.endpointUrl, mergedOptions.sampleRate, mergedOptions.onReport]);
};

export default useWebVitals;
