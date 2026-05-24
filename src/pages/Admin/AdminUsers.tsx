import React, { useEffect, useState } from 'react';
import { Trash2, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { apiDelete, apiGet, apiPut, invalidateApiCacheByPrefix } from '../../lib/apiClient';
import { useToast } from '../../components/Toast';
import { SmartImage } from '../../components/SmartImage';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_AVATAR } from '../../lib/defaultAvatar';
import { formatAdminRole } from '../../lib/formatUtils';
import type { AdminDataItem } from '../../types/entities';

const ADMIN_USERS_API_PREFIX = '/api/admin/users'

export const AdminUsers = () => {
  const { user: currentUser, profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [data, setData] = useState<AdminDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  const invalidateAdminUsersCache = () => invalidateApiCacheByPrefix(ADMIN_USERS_API_PREFIX)

  const getNextRole = (role?: string) => (role === 'admin' ? 'user' : 'admin')
  const getRoleToggleTitle = (role?: string) => (getNextRole(role) === 'admin' ? '设为管理员' : '设为普通用户')

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await apiGet<{ data: AdminDataItem[] }>(ADMIN_USERS_API_PREFIX);
      setData(result.data || []);
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleBan = async (target: AdminDataItem) => {
    if (!target.uid || target.uid === currentUser?.uid) return;
    const shouldUnban = target.status === 'banned';
    if (!window.confirm(`确定要${shouldUnban ? '解封' : '封禁'} ${target.displayName || target.uid} 吗？`)) return;
    const note = window.prompt(shouldUnban ? '解封备注（可选）' : '封禁原因', shouldUnban ? '' : '违反社区规范') || '';
    if (!shouldUnban && !note.trim()) {
      show('请输入封禁原因', { variant: 'error' });
      return;
    }
    try {
      const endpoint = shouldUnban ? `/api/users/${target.uid}/unban` : `/api/users/${target.uid}/ban`;
      const result = await apiPut<{ user: AdminDataItem }>(endpoint, shouldUnban ? { note } : { reason: note, note });
      invalidateAdminUsersCache();
      setData((prev) => prev.map((item) => (item.uid === target.uid ? { ...item, ...result.user } : item)));
      show(shouldUnban ? '已解封' : '已封禁', { variant: 'success' });
    } catch (e) {
      show(shouldUnban ? '解封失败' : '封禁失败', { variant: 'error' });
    }
  };

  const toggleRole = async (target: AdminDataItem) => {
    if (!isSuperAdmin) {
      show('只有超级管理员可以更改权限', { variant: 'error' });
      return;
    }
    const newRole = getNextRole(target.role);
    if (!window.confirm(`确定要将 ${target.displayName || target.uid} 的角色更改为 ${formatAdminRole(newRole)} 吗？`)) return;
    try {
      await apiPut(`/api/users/${target.uid}/role`, { role: newRole });
      invalidateAdminUsersCache();
      setData((prev) => prev.map((item) => (item.uid === target.uid ? { ...item, role: newRole } : item)));
      show('角色已更新', { variant: 'success' });
    } catch (e) {
      show('更新角色失败', { variant: 'error' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary tracking-[0.12em]">用户管理</h1>
        <button onClick={fetchData} className="px-4 py-2 border border-border text-text-secondary hover:text-brand-gold hover:border-brand-gold rounded text-sm transition-all">
          <RefreshCw size={14} className="inline mr-1" /> 刷新
        </button>
      </div>

      <div className="bg-surface border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-alt border-b border-border">
                {['用户', '角色', '状态', '操作'].map((col) => (
                  <th key={col} className="px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-5 py-4"><div className="h-6 bg-surface-alt rounded" /></td>
                  </tr>
                ))
              ) : data.length > 0 ? (
                data.map((item) => (
                  <tr key={item.uid} className="hover:bg-surface-alt transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <SmartImage src={item.photoURL || DEFAULT_AVATAR} alt="" className="w-10 h-10 rounded-full object-cover bg-surface-alt" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">{item.displayName || item.uid}</p>
                          <p className="text-xs text-text-muted">{item.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={clsx('px-2 py-0.5 rounded text-[10px] font-medium', item.role === 'super_admin' ? 'bg-brand-gold/15 text-brand-gold' : item.role === 'admin' ? 'theme-status-error' : 'bg-surface-alt text-brand-gold')}>
                        {formatAdminRole(item.role)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={clsx('px-2 py-0.5 rounded text-[10px] font-medium', item.status === 'banned' ? 'theme-status-error' : 'theme-status-success')}>
                        {item.status === 'banned' ? '已封禁' : '正常'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isSuperAdmin && item.uid !== currentUser?.uid && (
                          <button onClick={() => toggleRole(item)} className="p-1.5 text-brand-gold hover:bg-surface-alt rounded transition-all" title={getRoleToggleTitle(item.role)}>
                            {getNextRole(item.role) === 'admin' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                          </button>
                        )}
                        {item.uid !== currentUser?.uid && (
                          <button onClick={() => toggleBan(item)} className={clsx('p-1.5 rounded transition-all', item.status === 'banned' ? 'theme-text-success hover:bg-surface-alt' : 'theme-icon-button-warning hover:bg-surface-alt')} title={item.status === 'banned' ? '解封' : '封禁'}>
                            {item.status === 'banned' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                          </button>
                        )}
                        <button onClick={() => {
                          if (window.confirm('确定删除此用户吗？')) {
                            apiDelete(`/api/admin/users/${item.uid}`).then(() => {
                              invalidateAdminUsersCache();
                              setData((prev) => prev.filter((d) => d.uid !== item.uid));
                              show('已删除', { variant: 'success' });
                            }).catch(() => show('删除失败', { variant: 'error' }));
                          }
                        }} className="p-1.5 theme-icon-button-danger hover:bg-surface-alt rounded transition-all" title="删除">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="px-5 py-16 text-center text-text-muted italic">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
