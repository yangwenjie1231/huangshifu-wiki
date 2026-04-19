import React, { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Loader2, RefreshCw, Trash2, XCircle, Cpu } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';

import { apiGet, apiPost } from '../../lib/apiClient';
import { useToast } from '../../components/Toast';

type EmbeddingsStatusSummary = {
  pending: number;
  processing: number;
  ready: number;
  failed: number;
  total: number;
};

type EmbeddingsStatus = {
  modelName: string;
  vectorSize: number;
  qdrantCollection: string;
  modelCacheDir: string;
  modelLoaded: boolean;
  modelError: string | null;
  usingModelScope: boolean;
  summary: EmbeddingsStatusSummary | {
    gallery: EmbeddingsStatusSummary;
    wiki: EmbeddingsStatusSummary;
    post: EmbeddingsStatusSummary;
  };
};

// 兼容新旧数据格式
function normalizeSummary(summary: EmbeddingsStatus['summary']) {
  // 新格式：包含 gallery/wiki/post
  if ('gallery' in summary) {
    return summary as { gallery: EmbeddingsStatusSummary; wiki: EmbeddingsStatusSummary; post: EmbeddingsStatusSummary };
  }
  // 旧格式：直接是统计数据，包装成 gallery 格式
  const oldSummary = summary as EmbeddingsStatusSummary;
  return {
    gallery: oldSummary,
    wiki: { pending: 0, processing: 0, ready: 0, failed: 0, total: 0 },
    post: { pending: 0, processing: 0, ready: 0, failed: 0, total: 0 },
  };
}

type EmbeddingsError = {
  id: string;
  galleryImageId: string;
  status: string;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  gallery?: {
    id: string;
    title: string;
  };
  imageUrl?: string;
};

type EmbeddingsErrorsResponse = {
  errors: EmbeddingsError[];
  total: number;
};

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: '等待中' },
    processing: { bg: 'bg-blue-100', text: 'text-blue-700', label: '处理中' },
    ready: { bg: 'bg-green-100', text: 'text-green-700', label: '就绪' },
    failed: { bg: 'bg-red-100', text: 'text-red-700', label: '失败' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', c.bg, c.text)}>
      {c.label}
    </span>
  );
};

export const EmbeddingsTab = () => {
  const [status, setStatus] = useState<EmbeddingsStatus | null>(null);
  const [errors, setErrors] = useState<EmbeddingsError[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [enqueueLimit, setEnqueueLimit] = useState(100);
  const { show } = useToast();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await apiGet<EmbeddingsStatus>('/api/embeddings/status');
      setStatus(response);
    } catch (error) {
      console.error('Fetch embeddings status failed:', error);
      show('获取向量状态失败', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchErrors = async () => {
    setLoadingErrors(true);
    try {
      const response = await apiGet<EmbeddingsErrorsResponse>('/api/embeddings/errors', { limit: 50 });
      setErrors(response.errors || []);
    } catch (error) {
      console.error('Fetch embeddings errors failed:', error);
      show('获取错误列表失败', { variant: 'error' });
    } finally {
      setLoadingErrors(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (showErrors && errors.length === 0) {
      fetchErrors();
    }
  }, [showErrors]);

  const handleEnqueueMissing = async () => {
    setActionLoading('enqueue');
    try {
      const response = await apiPost<{
        gallery?: { requested: number; queued: number };
        wiki?: { requested: number; queued: number };
        post?: { requested: number; queued: number };
        limit: number;
        type: string;
      }>('/api/embeddings/enqueue-missing', {
        limit: enqueueLimit,
      });

      const parts: string[] = [];
      if (response.gallery) {
        parts.push(`图库 ${response.gallery.queued} 个`);
      }
      if (response.wiki) {
        parts.push(`百科 ${response.wiki.queued} 个`);
      }
      if (response.post) {
        parts.push(`帖子 ${response.post.queued} 个`);
      }

      show(parts.length > 0 ? `已加入队列: ${parts.join(', ')}` : '没有需要加入队列的任务');
      fetchStatus();
    } catch (error) {
      console.error('Enqueue missing embeddings failed:', error);
      show('补齐队列失败', { variant: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncBatch = async () => {
    if (!window.confirm('确定要批量同步向量吗？这可能需要一些时间。')) return;

    setActionLoading('sync');
    try {
      await apiPost('/api/embeddings/sync-batch', { limit: 100 });
      show('批量同步已启动');
      fetchStatus();
    } catch (error) {
      console.error('Sync batch embeddings failed:', error);
      show('批量同步失败', { variant: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryFailed = async () => {
    if (!window.confirm('确定要重试所有失败的向量任务吗？')) return;

    setActionLoading('retry');
    try {
      const response = await apiPost<{ resetCount: number }>('/api/embeddings/retry-failed');
      show(`已重置 ${response.resetCount} 个失败任务`);
      fetchStatus();
      if (showErrors) {
        fetchErrors();
      }
    } catch (error) {
      console.error('Retry failed embeddings failed:', error);
      show('重试失败', { variant: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRebuildAll = async () => {
    if (!window.confirm('确定要重建所有向量吗？这将删除现有向量并重新生成，耗时较长。')) return;
    if (!window.confirm('此操作不可逆，确定要继续吗？')) return;

    setActionLoading('rebuild');
    try {
      await apiPost('/api/embeddings/rebuild-all');
      show('重建任务已启动');
      fetchStatus();
    } catch (error) {
      console.error('Rebuild all embeddings failed:', error);
      show('重建失败', { variant: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // 使用 normalizeSummary 处理数据兼容性
  const summary = status ? normalizeSummary(status.summary) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-bold text-gray-900">向量 Embeddings 管理</h2>
        <button
          onClick={fetchStatus}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 inline-flex items-center gap-1"
        >
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {status && summary && (
        <>
          {/* Gallery 统计 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">图库图片</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">等待中</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{summary.gallery.pending}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw size={16} className="text-blue-400 animate-spin" />
                  <span className="text-sm text-gray-500">处理中</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{summary.gallery.processing}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={16} className="text-green-400" />
                  <span className="text-sm text-gray-500">就绪</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{summary.gallery.ready}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-sm text-gray-500">失败</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{summary.gallery.failed}</p>
              </div>
            </div>
          </div>

          {/* Wiki 统计 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">百科图片</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">等待中</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{summary.wiki.pending}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw size={16} className="text-blue-400 animate-spin" />
                  <span className="text-sm text-gray-500">处理中</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{summary.wiki.processing}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={16} className="text-green-400" />
                  <span className="text-sm text-gray-500">就绪</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{summary.wiki.ready}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-sm text-gray-500">失败</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{summary.wiki.failed}</p>
              </div>
            </div>
          </div>

          {/* Post 统计 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">帖子图片</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">等待中</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{summary.post.pending}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw size={16} className="text-blue-400 animate-spin" />
                  <span className="text-sm text-gray-500">处理中</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{summary.post.processing}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={16} className="text-green-400" />
                  <span className="text-sm text-gray-500">就绪</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{summary.post.ready}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-sm text-gray-500">失败</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{summary.post.failed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">配置信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">模型：</span>
                <span className="font-medium text-gray-900">{status.modelName}</span>
              </div>
              <div>
                <span className="text-gray-500">向量维度：</span>
                <span className="font-medium text-gray-900">{status.vectorSize}</span>
              </div>
              <div>
                <span className="text-gray-500">集合名称：</span>
                <span className="font-medium text-gray-900">{status.qdrantCollection}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-500">模型状态：</span>
                {status.modelLoaded ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                    已加载
                  </span>
                ) : status.modelError ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                    加载失败
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                    未加载
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  ({status.usingModelScope ? 'ModelScope 镜像' : 'Hugging Face'})
                </span>
              </div>
              {status.modelError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl mt-2">
                  <p className="text-xs text-red-600 font-medium mb-1">模型加载错误：</p>
                  <p className="text-xs text-red-500">{status.modelError}</p>
                </div>
              )}
              <div className="mt-2 text-xs text-gray-400">
                缓存目录：{status.modelCacheDir}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">批量操作</h3>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={enqueueLimit}
                  onChange={(e) => setEnqueueLimit(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  min={1}
                  max={2000}
                />
                <button
                  onClick={handleEnqueueMissing}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {actionLoading === 'enqueue' ? <Loader2 size={14} className="animate-spin" /> : null}
                  补齐缺失
                </button>
              </div>

              <button
                onClick={handleSyncBatch}
                disabled={actionLoading !== null}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {actionLoading === 'sync' ? <Loader2 size={14} className="animate-spin" /> : null}
                批量同步
              </button>

              <button
                onClick={() => setShowErrors(!showErrors)}
                disabled={actionLoading !== null}
                className={clsx(
                  'px-4 py-2 rounded-xl border text-sm font-semibold inline-flex items-center gap-2',
                  showErrors
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50',
                  actionLoading !== null && 'opacity-50',
                )}
              >
                <AlertTriangle size={14} />
                查看错误 ({summary.gallery.failed + summary.wiki.failed + summary.post.failed})
              </button>

              <button
                onClick={handleRetryFailed}
                disabled={actionLoading !== null || (summary.gallery.failed + summary.wiki.failed + summary.post.failed) === 0}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {actionLoading === 'retry' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                重试失败
              </button>

              <button
                onClick={handleRebuildAll}
                disabled={actionLoading !== null}
                className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {actionLoading === 'rebuild' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                重建全部
              </button>
            </div>
          </div>
        </>
      )}

      {showErrors && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">错误列表</h3>
            <button
              onClick={() => setShowErrors(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <XCircle size={18} />
            </button>
          </div>

          {loadingErrors ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : errors.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50"
                >
                  <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={error.status} />
                      <span className="text-xs text-gray-400">
                        {format(new Date(error.updatedAt), 'yyyy-MM-dd HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">
                      {error.gallery?.title || `图片 ID: ${error.galleryImageId}`}
                    </p>
                    {error.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">{error.errorMessage}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">暂无错误</div>
          )}
        </div>
      )}
    </div>
  );
};