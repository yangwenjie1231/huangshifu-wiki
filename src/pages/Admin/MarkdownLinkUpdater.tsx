/**
 * Markdown 链接批量更新管理页面
 * 
 * 功能：
 * - 扫描 Wiki 页面的资源链接分布
 * - 预览链接更新效果
 * - 批量更新资源链接
 * - 切换存储策略
 */

import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/apiClient';
import { useToast } from '../../components/Toast';

interface LinkMapping {
  oldUrl: string;
  newUrl: string;
  useRegex?: boolean;
}

interface ScanResult {
  totalPages: number;
  localLinkCount: number;
  externalLinkCount: number;
  s3LinkCount: number;
  unknownLinkCount: number;
  details: Array<{
    slug: string;
    title: string;
    distribution: {
      localLinks: string[];
      externalLinks: string[];
      s3Links: string[];
      unknownLinks: string[];
    };
  }>;
}

interface UpdateResult {
  totalPages: number;
  successCount: number;
  failCount: number;
  skipCount: number;
  executionTime: number;
  results: Array<{
    slug: string;
    title: string;
    success: boolean;
    error?: string;
    replaceResult?: {
      replaced: boolean;
      replaceCount: number;
      replacements: Array<{
        oldUrl: string;
        newUrl: string;
        type: string;
      }>;
    };
  }>;
}

export default function MarkdownLinkUpdater() {
  const { show } = useToast();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  
  const [mappings, setMappings] = useState<LinkMapping[]>([
    { oldUrl: '', newUrl: '', useRegex: false },
  ]);
  const [previewResult, setPreviewResult] = useState<any[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [updating, setUpdating] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  
  const [fromStorage, setFromStorage] = useState<'local' | 's3' | 'external'>('local');
  const [toStorage, setToStorage] = useState<'local' | 's3' | 'external'>('s3');
  const [storageConfig, setStorageConfig] = useState({
    localBaseUrl: '/uploads/',
    s3BaseUrl: '',
    externalBaseUrl: '',
  });

  // 扫描链接分布
  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await apiGet<ScanResult>('/api/admin/wiki-links/scan');
      setScanResult(result);
      show('扫描完成', { variant: 'success' });
    } catch (error) {
      show('扫描失败', { variant: 'error' });
    } finally {
      setScanning(false);
    }
  };

  // 预览更新效果
  const handlePreview = async () => {
    const validMappings = mappings.filter(m => m.oldUrl && m.newUrl);
    if (validMappings.length === 0) {
      show('请至少填写一个链接映射', { variant: 'error' });
      return;
    }

    setPreviewing(true);
    try {
      const result = await apiPost<any[]>('/api/admin/wiki-links/preview', {
        mappings: validMappings,
      });
      setPreviewResult(result);
      show('预览完成', { variant: 'success' });
    } catch (error) {
      show('预览失败', { variant: 'error' });
    } finally {
      setPreviewing(false);
    }
  };

  // 执行更新
  const handleUpdate = async () => {
    const validMappings = mappings.filter(m => m.oldUrl && m.newUrl);
    if (validMappings.length === 0) {
      show('请至少填写一个链接映射', { variant: 'error' });
      return;
    }

    if (!dryRun) {
      const confirmed = window.confirm('确定要执行实际更新吗？此操作将修改 Wiki 页面内容。');
      if (!confirmed) return;
    }

    setUpdating(true);
    try {
      const result = await apiPost<UpdateResult>('/api/admin/wiki-links/update', {
        mappings: validMappings,
        dryRun,
      });
      setUpdateResult(result);
      show(dryRun ? '预览更新完成' : '更新完成', { variant: 'success' });
    } catch (error) {
      show('更新失败', { variant: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  // 切换存储策略
  const handleSwitchStorage = async () => {
    if (fromStorage === toStorage) {
      show('源存储和目标存储不能相同', { variant: 'error' });
      return;
    }

    if (!dryRun) {
      const confirmed = window.confirm('确定要执行存储策略切换吗？此操作将修改 Wiki 页面内容。');
      if (!confirmed) return;
    }

    setUpdating(true);
    try {
      const result = await apiPost<UpdateResult>('/api/admin/wiki-links/switch-storage', {
        fromStorage,
        toStorage,
        config: storageConfig,
        dryRun,
      });
      setUpdateResult(result);
      show(dryRun ? '预览切换完成' : '切换完成', { variant: 'success' });
    } catch (error) {
      show('切换失败', { variant: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  // 同步 ImageMap
  const handleSyncWithImageMap = async () => {
    if (!dryRun) {
      const confirmed = window.confirm('确定要同步 ImageMap 吗？此操作将修改 Wiki 页面内容。');
      if (!confirmed) return;
    }

    setUpdating(true);
    try {
      const result = await apiPost<any>('/api/admin/wiki-links/sync-with-imagemap', {
        dryRun,
      });
      if (result.result) {
        setUpdateResult(result.result);
      }
      show(result.message || (dryRun ? '预览同步完成' : '同步完成'), { variant: 'success' });
    } catch (error) {
      show('同步失败', { variant: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const addMapping = () => {
    setMappings([...mappings, { oldUrl: '', newUrl: '', useRegex: false }]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: keyof LinkMapping, value: string | boolean) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Markdown 链接批量更新</h2>
        <p className="text-sm text-gray-500">
          扫描和批量更新 Wiki 页面中的资源链接，支持存储策略切换。
        </p>
      </div>

      {/* 链接分布扫描 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">链接分布扫描</h3>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-4 py-2 bg-brand-primary text-gray-900 rounded-lg font-medium disabled:opacity-50"
        >
          {scanning ? '扫描中...' : '开始扫描'}
        </button>

        {scanResult && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{scanResult.totalPages}</div>
              <div className="text-sm text-blue-600/70">Wiki 页面</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{scanResult.localLinkCount}</div>
              <div className="text-sm text-green-600/70">本地链接</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{scanResult.s3LinkCount}</div>
              <div className="text-sm text-purple-600/70">S3 链接</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">{scanResult.externalLinkCount}</div>
              <div className="text-sm text-orange-600/70">外部链接</div>
            </div>
          </div>
        )}
      </div>

      {/* 存储策略切换 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">存储策略切换</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">源存储</label>
            <select
              value={fromStorage}
              onChange={(e) => setFromStorage(e.target.value as 'local' | 's3' | 'external')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            >
              <option value="local">本地存储</option>
              <option value="s3">S3 存储</option>
              <option value="external">外部图床</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">目标存储</label>
            <select
              value={toStorage}
              onChange={(e) => setToStorage(e.target.value as 'local' | 's3' | 'external')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            >
              <option value="local">本地存储</option>
              <option value="s3">S3 存储</option>
              <option value="external">外部图床</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
              />
              <span className="text-sm text-gray-700">预览模式（不实际修改）</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">本地基础 URL</label>
            <input
              type="text"
              value={storageConfig.localBaseUrl}
              onChange={(e) => setStorageConfig({ ...storageConfig, localBaseUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              placeholder="/uploads/"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">S3 基础 URL</label>
            <input
              type="text"
              value={storageConfig.s3BaseUrl}
              onChange={(e) => setStorageConfig({ ...storageConfig, s3BaseUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              placeholder="https://s3.example.com/"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">外部图床基础 URL</label>
            <input
              type="text"
              value={storageConfig.externalBaseUrl}
              onChange={(e) => setStorageConfig({ ...storageConfig, externalBaseUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              placeholder="https://external.com/"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSwitchStorage}
            disabled={updating || fromStorage === toStorage}
            className="px-4 py-2 bg-brand-primary text-gray-900 rounded-lg font-medium disabled:opacity-50"
          >
            {updating ? '处理中...' : dryRun ? '预览切换' : '执行切换'}
          </button>
          <button
            onClick={handleSyncWithImageMap}
            disabled={updating}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium disabled:opacity-50"
          >
            同步 ImageMap
          </button>
        </div>
      </div>

      {/* 自定义链接映射 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">自定义链接映射</h3>
        
        {mappings.map((mapping, index) => (
          <div key={index} className="flex gap-2 mb-2 items-start">
            <input
              type="text"
              value={mapping.oldUrl}
              onChange={(e) => updateMapping(index, 'oldUrl', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              placeholder="原始链接"
            />
            <input
              type="text"
              value={mapping.newUrl}
              onChange={(e) => updateMapping(index, 'newUrl', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              placeholder="新链接"
            />
            <label className="flex items-center gap-1 px-3 py-2">
              <input
                type="checkbox"
                checked={mapping.useRegex}
                onChange={(e) => updateMapping(index, 'useRegex', e.target.checked)}
                className="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
              />
              <span className="text-sm text-gray-600">正则</span>
            </label>
            <button
              onClick={() => removeMapping(index)}
              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              disabled={mappings.length === 1}
            >
              删除
            </button>
          </div>
        ))}

        <button
          onClick={addMapping}
          className="mt-2 px-4 py-2 text-sm text-brand-olive border border-brand-olive/30 rounded-lg hover:bg-brand-olive/5"
        >
          + 添加映射
        </button>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium disabled:opacity-50"
          >
            {previewing ? '预览中...' : '预览效果'}
          </button>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="px-4 py-2 bg-brand-primary text-gray-900 rounded-lg font-medium disabled:opacity-50"
          >
            {updating ? '更新中...' : dryRun ? '预览更新' : '执行更新'}
          </button>
        </div>
      </div>

      {/* 预览结果 */}
      {previewResult && previewResult.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">预览结果</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {previewResult.map((item) => (
              <div key={item.slug} className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-900">{item.title}</div>
                <div className="text-sm text-gray-500">{item.slug}</div>
                {item.preview.replaced ? (
                  <div className="mt-2 text-sm">
                    <span className="text-green-600">将替换 {item.preview.replaceCount} 处</span>
                    <ul className="mt-1 space-y-1">
                      {item.preview.replacements.map((r: any, i: number) => (
                        <li key={i} className="text-xs text-gray-600">
                          {r.type}: {r.oldUrl} → {r.newUrl}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-gray-400">无变化</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 更新结果 */}
      {updateResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {dryRun ? '预览更新结果' : '更新结果'}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{updateResult.totalPages}</div>
              <div className="text-sm text-blue-600/70">处理页面</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{updateResult.successCount}</div>
              <div className="text-sm text-green-600/70">成功</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">{updateResult.skipCount}</div>
              <div className="text-sm text-yellow-600/70">跳过</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{updateResult.failCount}</div>
              <div className="text-sm text-red-600/70">失败</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            执行时间: {updateResult.executionTime}ms
          </div>

          {updateResult.results.some(r => !r.success) && (
            <div className="mt-4">
              <h4 className="font-medium text-red-600 mb-2">失败详情</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {updateResult.results
                  .filter(r => !r.success)
                  .map(r => (
                    <div key={r.slug} className="text-sm text-red-600">
                      {r.title} ({r.slug}): {r.error}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
