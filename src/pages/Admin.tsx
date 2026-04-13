import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Book,
  CheckCircle,
  Image as ImageIcon,
  Layers,
  Megaphone,
  MessageSquare,
  Music as MusicIcon,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
  Lock,
  FileText,
  Cpu,
  Database,
  Image,
  Gift,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/apiClient';
import { formatDateTime, toDateValue } from '../lib/dateUtils';
import { useToast } from '../components/Toast';
import { SmartImage } from '../components/SmartImage';
import { EmbeddingsTab } from './Admin/EmbeddingsTab';
import { BackupsTab } from './Admin/BackupsTab';
import { ImagesTab } from './Admin/ImagesTab';
import type { ReviewQueueItem, ReviewQueueBucket, EditLockItem, AdminDataItem } from '../types/entities';

type AdminTab = 'reviews' | 'wiki' | 'posts' | 'galleries' | 'users' | 'sections' | 'announcements' | 'music' | 'locks' | 'moderation_logs' | 'ban_logs' | 'embeddings' | 'backups' | 'sensitive_check' | 'images' | 'birthday';
type ReviewFilter = 'all' | 'wiki' | 'posts';

interface BirthdayConfig {
  id: string;
  type: string;
  title: string;
  content: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const Admin = () => {
  const { user, profile, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('reviews');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminDataItem[]>([]);

  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewQueueItem[]>();

  const [newSection, setNewSection] = useState({ name: '', description: '', order: 0 });
  const [newAnnouncement, setNewAnnouncement] = useState({ content: '', link: '', active: true });
  const { show } = useToast();

  const [sensitiveCheckText, setSensitiveCheckText] = useState('');
  const [sensitiveCheckResult, setSensitiveCheckResult] = useState<string[]>([]);
  const [sensitiveCheckLoading, setSensitiveCheckLoading] = useState(false);

  const [birthdayFilter, setBirthdayFilter] = useState<string>('all');
  const [editingConfig, setEditingConfig] = useState<BirthdayConfig | null>(null);
  const [newConfig, setNewConfig] = useState({ type: 'notice', title: '', content: '', sortOrder: 0 });

  const isSuperAdmin = profile?.role === 'super_admin';

  const tabConfig = useMemo(
    () => [
      { id: 'reviews' as const, label: '审核队列', icon: CheckCircle },
      { id: 'wiki' as const, label: '百科管理', icon: Book },
      { id: 'music' as const, label: '音乐管理', icon: MusicIcon },
      { id: 'embeddings' as const, label: '向量管理', icon: Cpu },
      { id: 'posts' as const, label: '帖子管理', icon: MessageSquare },
      { id: 'sections' as const, label: '版块管理', icon: Layers },
      { id: 'announcements' as const, label: '公告管理', icon: Megaphone },
      { id: 'galleries' as const, label: '图集管理', icon: ImageIcon },
      { id: 'users' as const, label: '用户管理', icon: Users },
      { id: 'locks' as const, label: '编辑锁', icon: Lock },
      { id: 'moderation_logs' as const, label: '操作日志', icon: FileText },
      { id: 'ban_logs' as const, label: '封禁日志', icon: Shield },
      ...(isSuperAdmin ? [{ id: 'backups' as const, label: '数据库备份', icon: Database }] : []),
      { id: 'sensitive_check' as const, label: '敏感词检测', icon: ShieldCheck },
      { id: 'images' as const, label: '图片管理', icon: Image },
      { id: 'birthday' as const, label: '生贺配置', icon: Gift },
    ],
    [],
  );

  const fetchReviewQueue = async () => {
    setReviewLoading(true);
    try {
      const requests: Promise<ReviewQueueBucket>[] = [];
      if (reviewFilter === 'all' || reviewFilter === 'wiki') {
        requests.push(apiGet<ReviewQueueBucket>('/api/admin/review-queue', { type: 'wiki', status: 'pending' }));
      }
      if (reviewFilter === 'all' || reviewFilter === 'posts') {
        requests.push(apiGet<ReviewQueueBucket>('/api/admin/review-queue', { type: 'posts', status: 'pending' }));
      }

      const result = await Promise.all(requests);
      const merged = result.flatMap((bucket) =>
        (bucket.items || []).map((item) => ({
          ...item,
          reviewType: bucket.type,
          reviewId: bucket.type === 'wiki' ? item.slug : item.id,
        })),
      );

      merged.sort((a, b) => {
        const left = toDateValue(a.updatedAt as string | undefined)?.getTime() || 0;
        const right = toDateValue(b.updatedAt as string | undefined)?.getTime() || 0;
        return right - left;
      });

      setReviewItems(merged);
    } catch (error) {
      console.error('Error fetching review queue:', error);
    } finally {
      setReviewLoading(false);
    }
  };

  const fetchData = async () => {
    if (activeTab === 'backups' || activeTab === 'sensitive_check' || activeTab === 'embeddings') {
      return;
    }
    setLoading(true);
    try {
      if (activeTab === 'locks') {
        const result = await apiGet<{ locks: EditLockItem[] }>('/api/admin/locks');
        setData((result.locks || []) as AdminDataItem[]);
      } else if (activeTab === 'moderation_logs') {
        const result = await apiGet<{ logs: AdminDataItem[] }>('/api/admin/moderation_logs');
        setData(result.logs || []);
      } else if (activeTab === 'ban_logs') {
        const result = await apiGet<{ logs: AdminDataItem[] }>('/api/admin/ban_logs');
        setData(result.logs || []);
      } else if (activeTab === 'birthday') {
        const result = await apiGet<BirthdayConfig[]>('/api/birthday/config');
        setData((result || []) as unknown as AdminDataItem[]);
      } else {
        const result = await apiGet<{ data: AdminDataItem[] }>(`/api/admin/${activeTab}`);
        setData(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reviews') {
      fetchReviewQueue();
      return;
    }
    fetchData();
  }, [activeTab, reviewFilter]);

  const handleReviewAction = async (item: ReviewQueueItem, action: 'approve' | 'reject') => {
    const note =
      window.prompt(action === 'approve' ? '通过备注（可选）' : '驳回原因（可选）', action === 'reject' ? '请按规范完善内容' : '') || '';
    try {
      await apiPost(`/api/admin/review/${item.reviewType}/${item.reviewId}/${action}`, { note });
      await fetchReviewQueue();
    } catch (error) {
      console.error(`${action} review item error:`, error);
      show(action === 'approve' ? '审核通过失败' : '驳回失败', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这项内容吗？此操作不可撤销。')) return;
    try {
      if (activeTab === 'locks') {
        await apiDelete(`/api/admin/locks/${id}`);
      } else {
        await apiDelete(`/api/admin/${activeTab}/${id}`);
      }
      setData((prev) => prev.filter((item) => (item.docId || item.id || item.uid) !== id));
    } catch (error) {
      console.error('Delete error:', error);
      show('删除失败', { variant: 'error' });
    }
  };

  const toggleUserBan = async (targetUser: AdminDataItem) => {
    if (!targetUser?.uid || targetUser.uid === user?.uid) return;
    const shouldUnban = targetUser.status === 'banned';
    const question = shouldUnban
      ? `确定要解封 ${targetUser.displayName || targetUser.uid} 吗？`
      : `确定要封禁 ${targetUser.displayName || targetUser.uid} 吗？`;
    if (!window.confirm(question)) return;

    const note = window.prompt(shouldUnban ? '解封备注（可选）' : '封禁原因', shouldUnban ? '' : '违反社区规范') || '';
    if (!shouldUnban && !note.trim()) {
      show('请输入封禁原因', { variant: 'error' });
      return;
    }

    try {
      const endpoint = shouldUnban ? `/api/admin/users/${targetUser.uid}/unban` : `/api/admin/users/${targetUser.uid}/ban`;
      const result = await apiPost<{ user: AdminDataItem }>(endpoint, shouldUnban ? { note } : { reason: note, note });
      setData((prev) => prev.map((item) => (item.uid === targetUser.uid ? { ...item, ...result.user } : item)));
    } catch (error) {
      console.error('Toggle user ban error:', error);
      show(shouldUnban ? '解封失败' : '封禁失败', { variant: 'error' });
    }
  };

  const toggleAdminRole = async (targetUser: AdminDataItem) => {
    if (!isSuperAdmin) {
      show('只有超级管理员可以更改权限', { variant: 'error' });
      return;
    }
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`确定要将 ${targetUser.displayName || targetUser.uid} 的角色更改为 ${newRole} 吗？`)) return;
    try {
      await apiPatch(`/api/users/${targetUser.uid}/role`, { role: newRole });
      setData((prev) => prev.map((item) => (item.uid === targetUser.uid ? { ...item, role: newRole } : item)));
    } catch (error) {
      console.error('Update role error:', error);
      show('更新角色失败', { variant: 'error' });
    }
  };

  const handleAddSection = async () => {
    if (!newSection.name.trim()) return;
    try {
      await apiPost('/api/sections', {
        name: newSection.name.trim(),
        description: newSection.description.trim(),
        order: Number.isFinite(newSection.order) ? newSection.order : 0,
      });
      setNewSection({ name: '', description: '', order: 0 });
      await fetchData();
    } catch (error) {
      console.error('Add section error:', error);
      show('新增版块失败', { variant: 'error' });
    }
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.content.trim()) return;
    try {
      await apiPost('/api/announcements', {
        content: newAnnouncement.content.trim(),
        link: newAnnouncement.link.trim() || null,
        active: newAnnouncement.active,
      });
      setNewAnnouncement({ content: '', link: '', active: true });
      await fetchData();
    } catch (error) {
      console.error('Add announcement error:', error);
      show('新增公告失败', { variant: 'error' });
    }
  };

  const toggleAnnouncement = async (ann: AdminDataItem) => {
    try {
      const result = await apiPatch<{ announcement: AdminDataItem }>(`/api/announcements/${ann.id}`, { active: !ann.active });
      const updated = result.announcement;
      setData((prev) => prev.map((item) => (item.id === ann.id ? { ...item, active: updated?.active ?? !ann.active } : item)));
    } catch (error) {
      console.error('Toggle announcement error:', error);
      show('更新公告状态失败', { variant: 'error' });
    }
  };

  const forceReleaseLock = async (lock: EditLockItem) => {
    if (!window.confirm('确定要强制释放这个编辑锁吗？')) return;
    try {
      await apiDelete(`/api/admin/locks/${lock.collection}/${encodeURIComponent(lock.recordId)}`);
      setData((prev) => prev.filter((item) => item.id !== lock.id));
    } catch (error) {
      console.error('Force release lock error:', error);
      show('强制释放失败', { variant: 'error' });
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <AlertTriangle size={64} className="mx-auto text-red-500 mb-6" />
        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-4">访问受限</h1>
        <p className="text-gray-500">您没有权限访问管理后台。</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-brand-primary text-gray-900 rounded-2xl shadow-lg">
            <Shield size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-serif font-bold text-gray-900">管理后台</h1>
            <p className="text-gray-500 italic">内容管理与社区维护</p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-4 mb-8">
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-6 py-3 rounded-3xl font-bold transition-all flex items-center gap-3 shadow-sm border',
              activeTab === tab.id
                ? 'bg-brand-primary text-gray-900 border-brand-primary'
                : 'bg-white text-gray-500 border-gray-100 hover:border-brand-primary/20',
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sections' && (
        <div className="mb-8 p-6 bg-brand-cream/30 rounded-[28px] border border-brand-primary/10">
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plus size={18} /> 新增论坛版块
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="版块名称"
              value={newSection.name}
              onChange={(event) => setNewSection((prev) => ({ ...prev, name: event.target.value }))}
              className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <input
              type="text"
              placeholder="描述"
              value={newSection.description}
              onChange={(event) => setNewSection((prev) => ({ ...prev, description: event.target.value }))}
              className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <input
              type="number"
              placeholder="排序"
              value={newSection.order}
              onChange={(event) => setNewSection((prev) => ({ ...prev, order: Number(event.target.value || 0) }))}
              className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <button onClick={handleAddSection} className="px-6 py-2 bg-brand-primary text-gray-900 rounded-xl font-bold">
              添加版块
            </button>
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="mb-8 p-6 bg-brand-cream/30 rounded-[28px] border border-brand-primary/10">
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plus size={18} /> 新增公告
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="公告内容"
              value={newAnnouncement.content}
              onChange={(event) => setNewAnnouncement((prev) => ({ ...prev, content: event.target.value }))}
              className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20 md:col-span-2"
            />
            <input
              type="text"
              placeholder="跳转链接 (可选)"
              value={newAnnouncement.link}
              onChange={(event) => setNewAnnouncement((prev) => ({ ...prev, link: event.target.value }))}
              className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <button onClick={handleAddAnnouncement} className="px-6 py-2 bg-brand-primary text-gray-900 rounded-xl font-bold">
              发布公告
            </button>
          </div>
        </div>
      )}

      {activeTab === 'reviews' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-[28px] border border-gray-100 p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {[
                { id: 'all', label: '全部待审' },
                { id: 'wiki', label: '百科待审' },
                { id: 'posts', label: '帖子待审' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setReviewFilter(item.id as ReviewFilter)}
                  className={clsx(
                    'px-4 py-2 rounded-full text-xs font-bold transition-all',
                    reviewFilter === item.id ? 'bg-brand-primary text-gray-900' : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              onClick={fetchReviewQueue}
              className="px-4 py-2 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:border-brand-primary hover:text-brand-primary"
            >
              刷新队列
            </button>
          </div>

          {reviewLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-white rounded-3xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : reviewItems.length > 0 ? (
            <div className="space-y-4">
              {reviewItems.map((item) => (
                <div key={`${item.reviewType}-${item.reviewId}`} className="bg-white rounded-3xl border border-gray-100 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={clsx(
                            'px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider',
                            item.reviewType === 'wiki' ? 'bg-brand-cream text-brand-olive' : 'bg-brand-primary/10 text-brand-primary',
                          )}
                        >
                          {item.reviewType === 'wiki' ? '百科' : '帖子'}
                        </span>
                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">待审核</span>
                      </div>
                      <p className="font-bold text-gray-800 mb-1">{item.title || item.slug || item.id}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{(String(item.content || '')).replace(/[#*`]/g, '').slice(0, 160) || '无内容摘要'}</p>
                      <p className="text-[10px] text-gray-400 mt-2">更新时间：{formatDateTime(item.updatedAt, 'N/A')}</p>
                      {Array.isArray(item.sensitiveWords) && (item.sensitiveWords as string[]).length > 0 && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                          <span className="text-[10px] font-bold text-red-600">检测到敏感词: </span>
                          {(item.sensitiveWords as string[]).map((w: string) => (
                            <span key={w} className="text-[10px] text-red-500 mr-1">#{w}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReviewAction(item, 'reject')}
                        className="px-4 py-2 rounded-full text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        驳回
                      </button>
                      <button
                        onClick={() => handleReviewAction(item, 'approve')}
                        className="px-4 py-2 rounded-full text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100"
                      >
                        通过
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 py-16 text-center text-gray-400 italic">当前没有待审核内容</div>
          )}
        </div>
      ) : activeTab === 'embeddings' ? (
        <div className="bg-white rounded-[36px] border border-gray-100 shadow--sm overflow-hidden p-6">
          <EmbeddingsTab />
        </div>
      ) : activeTab === 'backups' ? (
        <div className="bg-white rounded-[36px] border border-gray-100 shadow-sm overflow-hidden p-6">
          <BackupsTab />
        </div>
      ) : activeTab === 'images' ? (
        <div className="bg-white rounded-[36px] border border-gray-100 shadow-sm overflow-hidden p-6">
          <ImagesTab />
        </div>
      ) : activeTab === 'sensitive_check' ? (
        <div className="bg-white rounded-[36px] border border-gray-100 shadow-sm overflow-hidden p-6">
          <h3 className="text-lg font-bold mb-4">敏感词检测工具</h3>
          <p className="text-sm text-gray-500 mb-4">输入文本内容进行敏感词检测</p>
          <textarea
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
            rows={8}
            placeholder="请输入要检测的文本内容..."
            value={sensitiveCheckText}
            onChange={(e) => setSensitiveCheckText(e.target.value)}
          />
          <button
            onClick={async () => {
              if (!sensitiveCheckText.trim()) return;
              setSensitiveCheckLoading(true);
              try {
                const data = await apiPost<{ sensitiveWords: string[] }>('/api/admin/check-sensitive', { text: sensitiveCheckText });
                setSensitiveCheckResult(data.sensitiveWords || []);
              } catch {
                show('检测失败', { variant: 'error' });
              } finally {
                setSensitiveCheckLoading(false);
              }
            }}
            disabled={sensitiveCheckLoading || !sensitiveCheckText.trim()}
            className="mt-4 px-6 py-2 bg-brand-primary text-gray-900 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-primary/90 transition-colors"
          >
            {sensitiveCheckLoading ? '检测中...' : '开始检测'}
          </button>
          {sensitiveCheckResult.length > 0 ? (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm font-bold text-red-600 mb-2">检测到 {sensitiveCheckResult.length} 个敏感词：</p>
              <div className="flex flex-wrap gap-2">
                {sensitiveCheckResult.map((word) => (
                  <span key={word} className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-medium">
                    {word}
                  </span>
                ))}
              </div>
            </div>
          ) : sensitiveCheckText.trim() && !sensitiveCheckLoading ? (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm font-bold text-green-600">未检测到敏感词</p>
            </div>
          ) : null}
        </div>
      ) : activeTab === 'birthday' ? (
        <div className="space-y-6">
          {/* 筛选器 */}
          <div className="bg-white rounded-[28px] border border-gray-100 p-4 flex flex-wrap items-center gap-4">
            <span className="text-sm font-bold">筛选类型：</span>
            {['all', 'notice', 'school_history', 'honor_alumni', 'campus', 'guestbook', 'contact', 'program'].map(type => (
              <button
                key={type}
                onClick={() => setBirthdayFilter(type)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                  birthdayFilter === type ? 'bg-brand-primary text-gray-900' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                )}
              >
                {type === 'all' ? '全部' : type === 'notice' ? '通知' : type === 'school_history' ? '校史' : type === 'honor_alumni' ? '校友' : type === 'campus' ? '校园' : type === 'guestbook' ? '留言壁' : type === 'contact' ? '联系' : '节目'}
              </button>
            ))}
          </div>

          {/* 新增表单 */}
          <div className="bg-white rounded-[28px] border border-gray-100 p-6">
            <h3 className="text-xl font-serif font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus size={18} /> 新增配置
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={newConfig.type}
                onChange={(e) => setNewConfig(prev => ({ ...prev, type: e.target.value }))}
                className="px-4 py-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="notice">通知公告</option>
                <option value="school_history">校史拾遗</option>
                <option value="honor_alumni">荣誉校友</option>
                <option value="campus">雅学之境</option>
                <option value="guestbook">学子留言壁</option>
                <option value="contact">联系我们</option>
                <option value="program">生贺节目</option>
              </select>
              <input
                type="text"
                placeholder="标题"
                value={newConfig.title}
                onChange={(e) => setNewConfig(prev => ({ ...prev, title: e.target.value }))}
                className="px-4 py-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20"
              />
              <input
                type="number"
                placeholder="排序"
                value={newConfig.sortOrder}
                onChange={(e) => setNewConfig(prev => ({ ...prev, sortOrder: Number(e.target.value) }))}
                className="px-4 py-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20"
              />
              <button
                onClick={async () => {
                  if (!newConfig.title.trim()) return;
                  try {
                    await apiPost('/api/birthday/config', newConfig);
                    setNewConfig({ type: 'notice', title: '', content: '', sortOrder: 0 });
                    await fetchData();
                    show('配置已创建', { variant: 'success' });
                  } catch {
                    show('创建失败', { variant: 'error' });
                  }
                }}
                className="px-6 py-2 bg-brand-primary text-gray-900 rounded-xl font-bold hover:bg-brand-primary/90"
              >
                添加配置
              </button>
            </div>
            <textarea
              placeholder="内容 (JSON 格式)"
              value={newConfig.content}
              onChange={(e) => setNewConfig(prev => ({ ...prev, content: e.target.value }))}
              className="w-full mt-3 px-4 py-2 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20 h-24"
            />
          </div>

          {/* 配置列表 */}
          <div className="bg-white rounded-[36px] border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">类型</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">标题</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">排序</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">状态</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-6 py-4"><div className="h-8 bg-gray-50 rounded-xl" /></td>
                      </tr>
                    ))
                  ) : (
                    (() => {
                      const currentData = (data as unknown as BirthdayConfig[]) || [];
                      const filteredData = birthdayFilter === 'all'
                        ? currentData
                        : currentData.filter(item => item.type === birthdayFilter);
                      return filteredData.length > 0 ? (
                        filteredData.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase rounded">
                                {item.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-gray-700">{item.title}</td>
                            <td className="px-6 py-4 text-gray-500">{item.sortOrder}</td>
                            <td className="px-6 py-4">
                              <span className={clsx(
                                'px-3 py-1 rounded-full text-[10px] font-bold uppercase',
                                item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              )}>
                                {item.isActive ? '启用' : '禁用'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      await apiPatch(`/api/birthday/config/${item.id}`, { isActive: !item.isActive });
                                      await fetchData();
                                      show(item.isActive ? '已禁用' : '已启用', { variant: 'success' });
                                    } catch {
                                      show('操作失败', { variant: 'error' });
                                    }
                                  }}
                                  className={clsx(
                                    'p-2 rounded-lg transition-all',
                                    item.isActive ? 'text-amber-500 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'
                                  )}
                                  title={item.isActive ? '禁用' : '启用'}
                                >
                                  {item.isActive ? <XCircle size={18} /> : <CheckCircle size={18} />}
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!window.confirm('确定要删除此配置吗？')) return;
                                    try {
                                      await apiDelete(`/api/birthday/config/${item.id}`);
                                      await fetchData();
                                      show('已删除', { variant: 'success' });
                                    } catch {
                                      show('删除失败', { variant: 'error' });
                                    }
                                  }}
                                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                                  title="删除"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-16 text-center text-gray-400 italic">暂无配置</td>
                        </tr>
                      );
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'moderation_logs' || activeTab === 'ban_logs' ? (
        <div className="bg-white rounded-[36px] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-cream/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">时间</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">操作者</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">目标</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">操作类型</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="h-8 bg-gray-50 rounded-xl" />
                      </td>
                    </tr>
                  ))
                ) : data.length > 0 ? (
                  data.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {formatDateTime(item.createdAt, 'N/A')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="font-bold text-brand-olive">{item.operatorName || item.operatorUid}</span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {activeTab === 'ban_logs' ? (
                          <span className="font-bold text-brand-olive">{item.targetName || item.targetUid}</span>
                        ) : (
                          <div>
                            <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase rounded">
                              {item.targetType}
                            </span>
                            <span className="ml-2 text-gray-500 font-mono text-xs">{item.targetId}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {activeTab === 'ban_logs' ? (
                          <span className={clsx(
                            'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                            item.action === 'ban' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          )}>
                            {item.action === 'ban' ? '封禁' : '解封'}
                          </span>
                        ) : (
                          <span className={clsx(
                            'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                            item.action === 'approve' ? 'bg-green-100 text-green-700' :
                            item.action === 'reject' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          )}>
                            {item.action === 'approve' ? '通过' : item.action === 'reject' ? '驳回' : item.action}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">
                        {item.note || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-gray-400 italic">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[36px] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-cream/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">内容详情</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">状态/分类</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60">最后更新</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-brand-olive/60 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="px-6 py-4">
                        <div className="h-8 bg-gray-50 rounded-xl" />
                      </td>
                    </tr>
                  ))
                ) : data.length > 0 ? (
                  data.map((item) => {
                    const rowId = String(item.docId || item.id || item.uid || '');
                    return (
                      <tr key={rowId} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {activeTab === 'users' ? (
                              <SmartImage src={item.photoURL || ''} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-100" />
                            ) : activeTab === 'galleries' ? (
                              <SmartImage
                                src={item.images?.[0]?.url || ''}
                                alt=""
                                className="w-12 h-12 rounded-xl object-cover bg-gray-100"
                              />
                            ) : activeTab === 'music' ? (
                              <SmartImage src={item.cover || ''} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center text-brand-olive">
                                {activeTab === 'wiki' ? <Book size={18} /> : activeTab === 'locks' ? <Lock size={18} /> : <MessageSquare size={18} />}
                              </div>
                            )}
                            <div>
                              {activeTab === 'locks' ? (
                                <>
                                  <p className="font-bold text-gray-700">{item.collection} / {item.recordId}</p>
                                  <p className="text-xs text-gray-400">{item.username} ({item.userId.slice(0, 8)})</p>
                                </>
                              ) : (
                                <>
                                  <p className="font-bold text-gray-700">{item.title || item.displayName || item.slug || item.id}</p>
                                  <p className="text-xs text-gray-400 truncate max-w-xs">
                                    {item.content?.slice(0, 60) || item.email || item.description || item.artist || ''}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {activeTab === 'users' ? (
                              <>
                                <span
                                  className={clsx(
                                    'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                                    item.role === 'super_admin'
                                      ? 'bg-purple-100 text-purple-600'
                                      : item.role === 'admin'
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-brand-cream text-brand-olive',
                                  )}
                                >
                                  {item.role === 'super_admin' ? '超级管理员' : item.role || 'user'}
                                </span>
                                <span
                                  className={clsx(
                                    'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                                    item.status === 'banned' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700',
                                  )}
                                >
                                  {item.status === 'banned' ? '已封禁' : '正常'}
                                </span>
                              </>
                            ) : activeTab === 'announcements' ? (
                              <span
                                className={clsx(
                                  'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                                  item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
                                )}
                              >
                                {item.active ? '启用中' : '已禁用'}
                              </span>
                            ) : activeTab === 'locks' ? (
                              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                                到期: {formatDateTime(item.expiresAt, 'N/A')}
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-cream text-brand-olive">
                                {item.category || item.section || item.name || item.status || '默认'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">
                          {activeTab === 'locks'
                            ? formatDateTime(item.createdAt)
                            : formatDateTime(item.updatedAt, item.order !== undefined ? `排序: ${item.order}` : 'N/A')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {activeTab === 'announcements' && (
                              <button
                                onClick={() => toggleAnnouncement(item)}
                                className={clsx(
                                  'p-2 rounded-lg transition-all',
                                  item.active ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50',
                                )}
                                title={item.active ? '禁用公告' : '启用公告'}
                              >
                                {item.active ? <CheckCircle size={18} /> : <XCircle size={18} />}
                              </button>
                            )}

                            {activeTab === 'users' && isSuperAdmin && item.uid !== user?.uid && (
                              <button
                                onClick={() => toggleAdminRole(item)}
                                className="p-2 text-brand-olive hover:bg-brand-cream rounded-lg transition-all"
                                title={item.role === 'admin' ? '取消管理员' : '设为管理员'}
                              >
                                {item.role === 'admin' ? <XCircle size={18} /> : <CheckCircle size={18} />}
                              </button>
                            )}

                            {activeTab === 'users' && item.uid !== user?.uid && (
                              <button
                                onClick={() => toggleUserBan(item)}
                                className={clsx(
                                  'p-2 rounded-lg transition-all',
                                  item.status === 'banned' ? 'text-green-600 hover:bg-green-50' : 'text-amber-600 hover:bg-amber-50',
                                )}
                                title={item.status === 'banned' ? '解封用户' : '封禁用户'}
                              >
                                {item.status === 'banned' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                              </button>
                            )}

                            {activeTab === 'locks' && (
                              <button
                                onClick={() => forceReleaseLock(item as unknown as EditLockItem)}
                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                title="强制释放"
                              >
                                <Lock size={18} />
                              </button>
                            )}

                            <button
                              onClick={() => handleDelete(rowId)}
                              className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                              title="删除"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-gray-400 italic">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
