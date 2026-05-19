import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Image, Trash2, RotateCcw, Loader2, CheckCircle, AlertTriangle, XCircle, Zap, Clock, BarChart3 } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/apiClient';
import { clsx } from 'clsx';

interface VariantStats {
  queueLength: number;
  processingCount: number;
  completedToday: number;
  failedToday: number;
  averageProcessingTime: number;
  timeoutCount: number;
}

interface CleanupStats {
  totalImages: number;
  completedVariants: number;
  failedVariants: number;
  pendingOrProcessing: number;
  estimatedOrphanedDirectories: number;
}

interface RebuildResponse {
  success: boolean;
  error?: string;
  jobId?: string;
  summary?: {
    totalScanned: number;
    queuedForRebuild: number;
    skipped: number;
    errors: number;
  };
  estimatedTimeSeconds?: number;
}

export const AdminVariantManager: React.FC = () => {
  const [variantStats, setVariantStats] = useState<VariantStats | null>(null);
  const [cleanupStats, setCleanupStats] = useState<CleanupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rebuildScope, setRebuildScope] = useState<string>('missing');
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<RebuildResponse | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ type: string; freedSpace: number; deletedCount: number; errorsCount: number } | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, cleanupData] = await Promise.all([
        apiGet<{ success: boolean; data: VariantStats }>('/api/admin/variants/stats'),
        apiGet<{ success: boolean; data: CleanupStats }>('/api/admin/variants/cleanup/stats').catch(() => ({ success: false, data: null as any })),
      ]);
      if (statsData.success) setVariantStats(statsData.data);
      if (cleanupData.success) setCleanupStats(cleanupData.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleRebuildVariants = async (scope: string) => {
    if (!confirm(`确定要执行"${scope === 'missing' ? '补全缺失' : scope === 'failed' ? '重建失败' : '全部重建'}"吗？`)) return;
    try {
      setRebuilding(true);
      setRebuildResult(null);
      const result = await apiPost<RebuildResponse>('/api/admin/images/rebuild-all-variants', { scope, batchSize: 100, dryRun: false });
      if (result.success) {
        setRebuildResult(result);
        setTimeout(() => fetchStats(), 2000);
      } else {
        throw new Error(result.error || '重建失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '重建失败');
    } finally {
      setRebuilding(false);
    }
  };

  const handleCleanupOrphaned = async () => {
    if (!confirm('确定要清理所有孤儿变体文件吗？')) return;
    try {
      setCleaning(true);
      setCleanupResult(null);
      const data = await apiPost<{ success: boolean; data: { freedSpace: number; deletedCount: number; errorsCount: number } }>('/api/admin/variants/cleanup/orphaned');
      if (data.success) {
        setCleanupResult({ type: 'orphaned', freedSpace: data.data.freedSpace, deletedCount: data.data.deletedCount, errorsCount: data.data.errorsCount });
        setTimeout(() => fetchStats(), 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '清理失败');
    } finally {
      setCleaning(false);
    }
  };

  const handleCleanupFailed = async () => {
    if (!confirm('确定要清理所有失败的变体文件吗？')) return;
    try {
      setCleaning(true);
      setCleanupResult(null);
      const data = await apiPost<{ success: boolean; data: { freedSpace: number; deletedCount: number; errorsCount: number } }>('/api/admin/variants/cleanup/failed');
      if (data.success) {
        setCleanupResult({ type: 'failed', freedSpace: data.data.freedSpace, deletedCount: data.data.deletedCount, errorsCount: data.data.errorsCount });
        setTimeout(() => fetchStats(), 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '清理失败');
    } finally {
      setCleaning(false);
    }
  };

  const handleCleanupAll = async () => {
    if (!confirm('确定要执行全量清理吗？这将同时清理孤儿文件和失败残留。')) return;
    try {
      setCleaning(true);
      setCleanupResult(null);
      const data = await apiPost<{ success: boolean; data: { totalFreedBytes: number; totalDeletedFiles: number; totalErrors: number } }>('/api/admin/variants/cleanup/all');
      if (data.success) {
        setCleanupResult({ type: 'all', freedSpace: data.data.totalFreedBytes, deletedCount: data.data.totalDeletedFiles, errorsCount: data.data.totalErrors });
        setTimeout(() => fetchStats(), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '全量清理失败');
    } finally {
      setCleaning(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const scopeOptions = [
    { value: 'missing', label: '补全缺失', desc: '仅处理没有变体的图片' },
    { value: 'failed', label: '重建失败', desc: '仅处理生成失败的图片' },
    { value: 'all', label: '全部重建', desc: '强制重新生成所有变体（慎用）' },
  ];

  if (loading && !variantStats && !cleanupStats) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2c2c2c] tracking-[0.12em]">变体管理</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-[#e0dcd3] rounded p-5 animate-pulse">
              <div className="h-4 bg-[#f0ece3] rounded w-16 mb-3" />
              <div className="h-8 bg-[#f0ece3] rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image size={24} className="text-[#c8951e]" />
          <h1 className="text-2xl font-bold text-[#2c2c2c] tracking-[0.12em]">变体管理</h1>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-[#e0dcd3] text-[#6b6560] hover:text-[#c8951e] hover:border-[#c8951e] rounded transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 rounded bg-red-50 border border-red-200">
          <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="p-1 text-red-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {variantStats && (
        <div className="bg-white border border-[#e0dcd3] rounded p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-[#9e968e]" />
            <h3 className="text-sm font-semibold text-[#6b6560]">生成队列</h3>
            <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-medium rounded border border-green-200">运行中</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: '等待处理', value: variantStats.queueLength, icon: Clock, color: 'text-[#2c2c2c]' },
              { label: '正在处理', value: variantStats.processingCount, icon: Loader2, color: 'text-[#c8951e]' },
              { label: '今日完成', value: variantStats.completedToday, icon: CheckCircle, color: 'text-green-600' },
              { label: '今日失败', value: variantStats.failedToday, icon: XCircle, color: 'text-red-500' },
              { label: '超时次数', value: variantStats.timeoutCount, icon: AlertTriangle, color: 'text-amber-500' },
              { label: '平均耗时', value: `${variantStats.averageProcessingTime}ms`, icon: Clock, color: 'text-[#6b6560]' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-[#f7f5f0] rounded p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={12} className="text-[#9e968e]" />
                    <span className="text-[11px] text-[#9e968e]">{item.label}</span>
                  </div>
                  <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cleanupStats && (
        <div className="bg-white border border-[#e0dcd3] rounded p-5">
          <div className="flex items-center gap-2 mb-4">
            <Image size={16} className="text-[#9e968e]" />
            <h3 className="text-sm font-semibold text-[#6b6560]">变体统计</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: '总图片数', value: cleanupStats.totalImages },
              { label: '已完成', value: cleanupStats.completedVariants, badge: 'bg-green-50 text-green-700' },
              { label: '失败数', value: cleanupStats.failedVariants, badge: 'bg-red-50 text-red-600' },
              { label: '待处理', value: cleanupStats.pendingOrProcessing, badge: 'bg-amber-50 text-amber-700' },
              { label: '孤儿目录', value: cleanupStats.estimatedOrphanedDirectories, badge: 'bg-[#fdf5d8] text-[#c8951e]' },
            ].map((item) => (
              <div key={item.label} className="bg-[#f7f5f0] rounded p-3">
                <span className="text-[11px] text-[#9e968e]">{item.label}</span>
                <p className={`text-lg font-bold ${item.badge ?? 'text-[#2c2c2c]'}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-[#e0dcd3] rounded p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-[#c8951e]" />
          <h3 className="text-sm font-semibold text-[#6b6560]">批量变体重建</h3>
        </div>
        <p className="text-xs text-[#9e968e] mb-4">为历史图片补全或重新生成 WebP 变体</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {scopeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRebuildScope(opt.value)}
              className={clsx(
                'px-3 py-1.5 rounded text-xs font-medium transition-all',
                rebuildScope === opt.value
                  ? 'bg-[#c8951e] text-white'
                  : 'bg-[#f7f5f0] text-[#6b6560] hover:bg-[#f0ece3] hover:text-[#c8951e]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-[#9e968e] mb-4">
          {scopeOptions.find((o) => o.value === rebuildScope)?.desc}
        </p>

        <button
          onClick={() => handleRebuildVariants(rebuildScope)}
          disabled={rebuilding}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#c8951e] text-white rounded text-sm font-medium hover:bg-[#dca828] transition-all disabled:opacity-50"
        >
          {rebuilding ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {rebuilding ? '正在处理...' : `开始重建`}
        </button>

        {rebuildResult && (
          <div className="mt-4 p-3 rounded bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} className="text-green-500" />
              <p className="text-sm font-medium text-green-600">重建任务已提交</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-[#9e968e]">扫描总数</span><p className="font-medium text-[#2c2c2c]">{rebuildResult.summary?.totalScanned ?? 0}</p></div>
              <div><span className="text-[#9e968e]">入队数量</span><p className="font-medium text-[#2c2c2c]">{rebuildResult.summary?.queuedForRebuild ?? 0}</p></div>
              <div><span className="text-[#9e968e]">跳过数量</span><p className="font-medium text-[#2c2c2c]">{rebuildResult.summary?.skipped ?? 0}</p></div>
              <div><span className="text-[#9e968e]">错误数量</span><p className={`font-medium ${(rebuildResult.summary?.errors ?? 0) > 0 ? 'text-red-600' : 'text-[#2c2c2c]'}`}>{rebuildResult.summary?.errors ?? 0}</p></div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#e0dcd3] rounded p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 size={16} className="text-[#9e968e]" />
          <h3 className="text-sm font-semibold text-[#6b6560]">变体清理</h3>
        </div>
        <p className="text-xs text-[#9e968e] mb-4">清理无效或多余的变体文件以释放磁盘空间</p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCleanupOrphaned}
            disabled={cleaning}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#e0dcd3] text-[#6b6560] hover:text-[#c8951e] hover:border-[#c8951e] rounded text-sm transition-all disabled:opacity-50"
          >
            <Trash2 size={14} /> 清理孤儿文件
          </button>
          <button
            onClick={handleCleanupFailed}
            disabled={cleaning}
            className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-all disabled:opacity-50"
          >
            <XCircle size={14} /> 清理失败残留
          </button>
          <button
            onClick={handleCleanupAll}
            disabled={cleaning}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#c8951e] text-white rounded text-sm font-medium hover:bg-[#dca828] transition-all disabled:opacity-50"
          >
            <RotateCcw size={14} /> 全量清理
          </button>
        </div>

        {cleaning && (
          <div className="mt-4 flex items-center gap-2 text-sm text-[#9e968e]">
            <Loader2 size={14} className="animate-spin" />
            <span>正在清理，请稍候...</span>
          </div>
        )}

        {cleanupResult && (
          <div className="mt-4 p-3 rounded bg-[#fdf5d8] border border-[#e0dcd3]">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} className="text-[#c8951e]" />
              <p className="text-sm font-medium text-[#2c2c2c]">清理完成</p>
              <span className="px-2 py-0.5 bg-[#f7f5f0] text-[#c8951e] text-[10px] font-medium rounded">{cleanupResult.type}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-[#9e968e]">释放空间</span><p className="font-medium text-green-600">{formatBytes(cleanupResult.freedSpace)}</p></div>
              <div><span className="text-[#9e968e]">删除文件</span><p className="font-medium text-[#2c2c2c]">{cleanupResult.deletedCount}</p></div>
              <div><span className="text-[#9e968e]">错误数量</span><p className={`font-medium ${cleanupResult.errorsCount > 0 ? 'text-red-600' : 'text-[#2c2c2c]'}`}>{cleanupResult.errorsCount}</p></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminVariantManager;
