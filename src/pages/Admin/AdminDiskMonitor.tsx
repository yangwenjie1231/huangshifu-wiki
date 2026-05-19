import React, { useState, useEffect, useCallback } from 'react';
import { HardDrive, RefreshCw, Settings, Save, X, RotateCcw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '../../lib/apiClient';

interface DiskStatus {
  totalSpaceGB: number;
  freeSpaceGB: number;
  usedSpaceGB: number;
  usagePercent: number;
  status: 'healthy' | 'warning' | 'critical';
  lastChecked: string;
  uploadsDir?: { fileCount: number; totalSizeMB: number };
  originalDir?: { fileCount: number; totalSizeMB: number };
  variantsDir?: { fileCount: number; totalSizeMB: number };
}

interface DiskMonitorConfig {
  warningThresholdGB: number;
  criticalThresholdGB: number;
  checkIntervalMs: number;
  uploadsMinFreeMB: number;
}

export const AdminDiskMonitor: React.FC = () => {
  const [diskStatus, setDiskStatus] = useState<DiskStatus | null>(null);
  const [config, setConfig] = useState<DiskMonitorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<Partial<DiskMonitorConfig>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const fetchDiskStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusRes, configRes] = await Promise.all([
        apiGet<{ success: boolean; data: DiskStatus; error?: string }>('/api/admin/disk/status'),
        apiGet<{ success: boolean; data: DiskMonitorConfig; error?: string }>('/api/admin/disk/config'),
      ]);
      if (statusRes.success) setDiskStatus(statusRes.data);
      if (configRes.success) setConfig(configRes.data);
    } catch (err) {
      console.error('Failed to fetch disk status:', err);
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiskStatus();
    const interval = setInterval(fetchDiskStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchDiskStatus]);

  const handleStartEdit = () => {
    if (config) {
      setEditingConfig({ ...config });
      setIsEditing(true);
      setValidationErrors([]);
      setSaveSuccess(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingConfig({});
    setValidationErrors([]);
  };

  const validateConfig = (nc: Partial<DiskMonitorConfig>): string[] => {
    const errors: string[] = [];
    if ('warningThresholdGB' in nc && (typeof nc.warningThresholdGB !== 'number' || nc.warningThresholdGB <= 0)) {
      errors.push('警告阈值必须是正数');
    }
    if ('criticalThresholdGB' in nc && (typeof nc.criticalThresholdGB !== 'number' || nc.criticalThresholdGB <= 0)) {
      errors.push('严重阈值必须是正数');
    }
    if (nc.warningThresholdGB && nc.criticalThresholdGB && nc.criticalThresholdGB >= nc.warningThresholdGB) {
      errors.push('严重阈值必须小于警告阈值');
    }
    if ('checkIntervalMs' in nc && (typeof nc.checkIntervalMs !== 'number' || nc.checkIntervalMs < 60000)) {
      errors.push('检查间隔必须 >= 60 秒');
    }
    if ('uploadsMinFreeMB' in nc && (typeof nc.uploadsMinFreeMB !== 'number' || nc.uploadsMinFreeMB < 10)) {
      errors.push('最小空闲空间必须 >= 10 MB');
    }
    return errors;
  };

  const handleSaveConfig = async () => {
    const errors = validateConfig(editingConfig);
    if (errors.length > 0) { setValidationErrors(errors); return; }
    try {
      setSaving(true);
      setValidationErrors([]);
      const result = await apiPut<{ success: boolean; data: DiskMonitorConfig; error?: string }>('/api/admin/disk/config', editingConfig);
      if (result.success) {
        setConfig(result.data);
        setIsEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!confirm('确定要重置为默认配置吗？')) return;
    try {
      setSaving(true);
      const result = await apiPost<{ success: boolean; data: DiskMonitorConfig }>('/api/admin/disk/config/reset');
      if (result.success) {
        setConfig(result.data);
        setEditingConfig({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败');
    } finally {
      setSaving(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'critical') return 'bg-red-50 text-red-600 border-red-200';
    if (status === 'warning') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-green-50 text-green-700 border-green-200';
  };

  const statusIcon = (status: string) => {
    if (status === 'critical') return <XCircle size={14} className="text-red-500" />;
    if (status === 'warning') return <AlertTriangle size={14} className="text-amber-500" />;
    return <CheckCircle size={14} className="text-green-500" />;
  };

  const barColor = (status: string) => {
    if (status === 'critical') return 'bg-red-400';
    if (status === 'warning') return 'bg-amber-400';
    return 'bg-[#c8951e]';
  };

  if (loading && !diskStatus) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#2c2c2c] tracking-[0.12em]">磁盘监控</h1>
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

  if (error && !diskStatus) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-[#2c2c2c] tracking-[0.12em]">磁盘监控</h1>
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <button onClick={fetchDiskStatus} className="mt-2 px-4 py-2 bg-[#c8951e] text-white rounded text-sm font-medium hover:bg-[#dca828] transition-all">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive size={24} className="text-[#c8951e]" />
          <h1 className="text-2xl font-bold text-[#2c2c2c] tracking-[0.12em]">磁盘监控</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDiskStatus}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#e0dcd3] text-[#6b6560] hover:text-[#c8951e] hover:border-[#c8951e] rounded transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 刷新
          </button>
          <button
            onClick={handleStartEdit}
            disabled={!config}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#c8951e] text-white rounded text-sm font-medium hover:bg-[#dca828] transition-all disabled:opacity-50"
          >
            <Settings size={16} /> 修改阈值
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 rounded bg-red-50 border border-red-200">
          <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="p-1 text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-3 p-3 rounded bg-green-50 border border-green-200">
          <CheckCircle size={18} className="text-green-500 shrink-0" />
          <p className="text-sm font-medium text-green-600">配置保存成功，新阈值已立即生效</p>
        </div>
      )}

      {diskStatus && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-[#e0dcd3] rounded p-5">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive size={14} className="text-[#9e968e]" />
                <span className="text-xs text-[#9e968e]">总容量</span>
              </div>
              <p className="text-2xl font-bold text-[#2c2c2c]">{diskStatus.totalSpaceGB.toFixed(1)}<span className="text-sm font-normal text-[#9e968e] ml-1">GB</span></p>
            </div>

            <div className="bg-white border border-[#e0dcd3] rounded p-5">
              <div className="flex items-center gap-2 mb-2">
                {statusIcon(diskStatus.status)}
                <span className="text-xs text-[#9e968e]">剩余空间</span>
              </div>
              <p className={`text-2xl font-bold ${diskStatus.status === 'critical' ? 'text-red-600' : 'text-[#2c2c2c]'}`}>
                {diskStatus.freeSpaceGB.toFixed(1)}<span className="text-sm font-normal text-[#9e968e] ml-1">GB</span>
              </p>
            </div>

            <div className="bg-white border border-[#e0dcd3] rounded p-5">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive size={14} className="text-[#9e968e]" />
                <span className="text-xs text-[#9e968e]">已使用</span>
              </div>
              <p className="text-2xl font-bold text-[#2c2c2c]">{diskStatus.usedSpaceGB.toFixed(1)}<span className="text-sm font-normal text-[#9e968e] ml-1">GB</span></p>
            </div>

            <div className="bg-white border border-[#e0dcd3] rounded p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColor(diskStatus.status)}`}>
                  {diskStatus.status === 'healthy' ? '健康' : diskStatus.status === 'warning' ? '警告' : '严重'}
                </span>
                <span className="text-xs text-[#9e968e]">使用率</span>
              </div>
              <div className="mt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xl font-bold text-[#2c2c2c]">{diskStatus.usagePercent.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-[#f0ece3] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor(diskStatus.status)}`} style={{ width: `${Math.min(diskStatus.usagePercent, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#e0dcd3] rounded p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#6b6560]">目录统计</h3>
              <span className="text-xs text-[#9e968e]">最后检查: {new Date(diskStatus.lastChecked).toLocaleString()}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f7f5f0] border-b border-[#e0dcd3]">
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#9e968e] uppercase tracking-wider">目录</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#9e968e] uppercase tracking-wider">文件数量</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-[#9e968e] uppercase tracking-wider">总大小</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ece3]">
                  <tr className="hover:bg-[#f7f5f0] transition-colors">
                    <td className="px-5 py-4 text-sm text-[#2c2c2c] font-medium">uploads/</td>
                    <td className="px-5 py-4 text-sm text-[#6b6560]">{diskStatus.uploadsDir?.fileCount ?? '-'}</td>
                    <td className="px-5 py-4 text-sm text-[#6b6560]">{diskStatus.uploadsDir?.totalSizeMB?.toFixed(1) ?? '-'} MB</td>
                  </tr>
                  <tr className="hover:bg-[#f7f5f0] transition-colors">
                    <td className="px-5 py-4 text-sm text-[#2c2c2c] font-medium">original/</td>
                    <td className="px-5 py-4 text-sm text-[#6b6560]">{diskStatus.originalDir?.fileCount ?? '-'}</td>
                    <td className="px-5 py-4 text-sm text-[#6b6560]">{diskStatus.originalDir?.totalSizeMB?.toFixed(1) ?? '-'} MB</td>
                  </tr>
                  <tr className="hover:bg-[#f7f5f0] transition-colors">
                    <td className="px-5 py-4 text-sm text-[#2c2c2c] font-medium">variants/</td>
                    <td className="px-5 py-4 text-sm text-[#6b6560]">{diskStatus.variantsDir?.fileCount ?? '-'}</td>
                    <td className="px-5 py-4 text-sm text-[#6b6560]">{diskStatus.variantsDir?.totalSizeMB?.toFixed(1) ?? '-'} MB</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {isEditing && config && (
        <div className="bg-white border border-[#e0dcd3] rounded p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Settings size={18} className="text-[#c8951e]" />
              <h3 className="text-sm font-semibold text-[#6b6560]">告警阈值配置</h3>
              <span className="px-2 py-0.5 bg-[#fdf5d8] text-[#c8951e] text-[10px] font-medium rounded">实时生效</span>
            </div>
            <button onClick={handleCancelEdit} className="p-1.5 text-[#9e968e] hover:text-[#2c2c2c] hover:bg-[#f7f5f0] rounded transition-all">
              <X size={18} />
            </button>
          </div>

          {validationErrors.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded bg-red-50 border border-red-200 mb-4">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <ul className="text-sm text-red-600 list-disc list-inside">
                {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-[#6b6560] mb-1">警告阈值 (GB)</label>
              <p className="text-xs text-[#9e968e] mb-2">低于此值时输出警告日志</p>
              <input
                type="number" min="1" step="0.1"
                value={editingConfig.warningThresholdGB ?? config.warningThresholdGB}
                onChange={(e) => setEditingConfig({ ...editingConfig, warningThresholdGB: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-[#e0dcd3] rounded text-sm focus:outline-none focus:border-[#c8951e]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#6b6560] mb-1">严重阈值 (GB)</label>
              <p className="text-xs text-[#9e968e] mb-2">低于此值时拒绝上传</p>
              <input
                type="number" min="1" step="0.1"
                value={editingConfig.criticalThresholdGB ?? config.criticalThresholdGB}
                onChange={(e) => setEditingConfig({ ...editingConfig, criticalThresholdGB: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-[#e0dcd3] rounded text-sm focus:outline-none focus:border-[#c8951e]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#6b6560] mb-1">检查间隔 (秒)</label>
              <p className="text-xs text-[#9e968e] mb-2">两次自动检查的时间间隔</p>
              <input
                type="number" min="60" step="10"
                value={(editingConfig.checkIntervalMs ?? config.checkIntervalMs) / 1000}
                onChange={(e) => setEditingConfig({ ...editingConfig, checkIntervalMs: parseInt(e.target.value) * 1000 })}
                className="w-full px-4 py-2 border border-[#e0dcd3] rounded text-sm focus:outline-none focus:border-[#c8951e]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#6b6560] mb-1">上传最小空间 (MB)</label>
              <p className="text-xs text-[#9e968e] mb-2">上传前必须保留的最小空闲空间</p>
              <input
                type="number" min="10" step="10"
                value={editingConfig.uploadsMinFreeMB ?? config.uploadsMinFreeMB}
                onChange={(e) => setEditingConfig({ ...editingConfig, uploadsMinFreeMB: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-[#e0dcd3] rounded text-sm focus:outline-none focus:border-[#c8951e]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-5 border-t border-[#f0ece3] mt-5">
            <button
              onClick={handleResetToDefaults}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-all disabled:opacity-50"
            >
              <RotateCcw size={14} /> 重置默认
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="px-4 py-2 rounded border border-[#e0dcd3] text-sm text-[#6b6560] hover:bg-[#f7f5f0] transition-all disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#c8951e] text-white rounded text-sm font-medium hover:bg-[#dca828] transition-all disabled:opacity-50"
            >
              <Save size={14} /> {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      )}

      {config && !isEditing && (
        <div className="bg-white border border-[#e0dcd3] rounded p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#6b6560]">当前配置</h3>
            <button onClick={handleStartEdit} className="p-1.5 text-[#c8951e] hover:bg-[#f7f5f0] rounded transition-all" title="编辑配置">
              <Settings size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[#9e968e] mb-1">警告阈值</p>
              <p className="text-sm font-medium text-[#2c2c2c]">{config.warningThresholdGB} GB</p>
            </div>
            <div>
              <p className="text-xs text-[#9e968e] mb-1">严重阈值</p>
              <p className="text-sm font-medium text-[#2c2c2c]">{config.criticalThresholdGB} GB</p>
            </div>
            <div>
              <p className="text-xs text-[#9e968e] mb-1">检查间隔</p>
              <p className="text-sm font-medium text-[#2c2c2c]">{config.checkIntervalMs / 1000} 秒</p>
            </div>
            <div>
              <p className="text-xs text-[#9e968e] mb-1">上传最小空间</p>
              <p className="text-sm font-medium text-[#2c2c2c]">{config.uploadsMinFreeMB} MB</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDiskMonitor;
