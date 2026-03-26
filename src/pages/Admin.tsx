import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Book, MessageSquare, Image as ImageIcon, Users, Trash2, CheckCircle, XCircle, AlertTriangle, ChevronRight, Layers, Plus, Save, Edit2, Megaphone, Music as MusicIcon } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/apiClient';

const toDateValue = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const Admin = () => {
  const { user, profile, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'reviews' | 'wiki' | 'posts' | 'galleries' | 'locks' | 'users' | 'sections' | 'announcements' | 'music'>('wiki');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wiki' | 'posts'>('all');
  const [reviewItems, setReviewItems] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [newSection, setNewSection] = useState({ name: '', description: '', order: 0 });
  const [newAnnouncement, setNewAnnouncement] = useState({ content: '', link: '', active: true });

  const isSuperAdmin = profile?.role === 'super_admin' || user?.email === 'yangwenjie1231@gmail.com';

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await apiGet<{ data: any[] }>(`/api/admin/${activeTab}`);
      const rows = response.data || [];
      const withEntityId = rows.map((item) => ({
        ...item,
        __entityId: item.docId || item.id || item.slug || item.uid,
      }));
      setData(withEntityId);
    } catch (e) {
      console.error("Error fetching admin data:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除这项内容吗？此操作不可撤销。")) return;
    try {
      if (activeTab === 'users') {
        alert('用户删除请改用封禁/解封治理，避免误删账号数据');
        return;
      }
      if (activeTab === 'posts') {
        await apiDelete(`/api/posts/${id}`);
      } else if (activeTab === 'sections') {
        await apiDelete(`/api/sections/${id}`);
      } else if (activeTab === 'announcements') {
        await apiDelete(`/api/announcements/${id}`);
      } else if (activeTab === 'music') {
        await apiDelete(`/api/music/${id}`);
      } else if (activeTab === 'galleries') {
        await apiDelete(`/api/galleries/${id}`);
      } else if (activeTab === 'locks') {
        await apiDelete(`/api/admin/locks/${id}`);
      } else if (activeTab === 'wiki') {
        await apiDelete(`/api/admin/wiki/${id}`);
      } else {
        await apiDelete(`/api/admin/${activeTab}/${id}`);
      }

      setData(prev => prev.filter(item => item.__entityId !== id));
    } catch (e) {
      console.error("Delete error:", e);
      alert("删除失败");
    }
  };

  const fetchReviewQueue = async () => {
    setReviewLoading(true);
    try {
      const requests: Promise<any>[] = [];
      if (reviewFilter === 'all' || reviewFilter === 'wiki') {
        requests.push(apiGet<{ type: 'wiki'; items: any[] }>('/api/admin/review-queue', { type: 'wiki', status: 'pending' }));
      }
      if (reviewFilter === 'all' || reviewFilter === 'posts') {
        requests.push(apiGet<{ type: 'posts'; items: any[] }>('/api/admin/review-queue', { type: 'posts', status: 'pending' }));
      }

      const result = await Promise.all(requests);
      const merged = result.flatMap((bucket) =>
        (bucket.items || []).map((item: any) => ({
          ...item,
          reviewType: bucket.type,
          reviewId: bucket.type === 'wiki' ? item.slug : item.id,
        })),
      );

      merged.sort((a, b) => {
        const left = new Date(a.updatedAt || 0).getTime();
        const right = new Date(b.updatedAt || 0).getTime();
        return right - left;
      });

      setReviewItems(merged);
    } catch (error) {
      console.error('Error fetching review queue:', error);
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reviews') {
      fetchReviewQueue();
      return;
    }
    fetchData();
  }, [activeTab, reviewFilter]);

  const handleReviewAction = async (item: any, action: 'approve' | 'reject') => {
    const note = window.prompt(action === 'approve' ? '通过备注（可选）' : '驳回原因（可选）', action === 'reject' ? '请按规范完善内容' : '') || '';
    try {
      await apiPost(`/api/admin/review/${item.reviewType}/${item.reviewId}/${action}`, {
        note,
      });
      await fetchReviewQueue();
    } catch (error) {
      console.error(`${action} review item error:`, error);
      alert(action === 'approve' ? '审核通过失败' : '驳回失败');
    }
  };

  const toggleUserBan = async (targetUser: any) => {
    if (!targetUser?.uid || targetUser.uid === user?.uid) return;
    const shouldUnban = targetUser.status === 'banned';
    const question = shouldUnban
      ? `确定要解封 ${targetUser.displayName || targetUser.uid} 吗？`
      : `确定要封禁 ${targetUser.displayName || targetUser.uid} 吗？`;
    if (!window.confirm(question)) return;

    const note = window.prompt(shouldUnban ? '解封备注（可选）' : '封禁原因', shouldUnban ? '' : '违反社区规范') || '';
    if (!shouldUnban && !note.trim()) {
      alert('请输入封禁原因');
      return;
    }

    try {
      const endpoint = shouldUnban ? `/api/admin/users/${targetUser.uid}/unban` : `/api/admin/users/${targetUser.uid}/ban`;
      const data = await apiPost<{ user: any }>(endpoint, shouldUnban ? { note } : { reason: note, note });
      setData((prev) => prev.map((item) => (item.uid === targetUser.uid ? { ...item, ...data.user } : item)));
    } catch (error) {
      console.error('Toggle user ban error:', error);
      alert(shouldUnban ? '解封失败' : '封禁失败');
    }
  };

  const toggleAdmin = async (targetUser: any) => {
    if (!isSuperAdmin) {
      alert("只有超级管理员可以更改权限");
      return;
    }
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`确定要将 ${targetUser.displayName} 的角色更改为 ${newRole} 吗？`)) return;
    try {
      await apiPatch(`/api/users/${targetUser.uid}/role`, { role: newRole });
      setData(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, role: newRole } : u));
    } catch (e) {
      console.error("Update role error:", e);
      alert("更新角色失败");
    }
  };

  const handleAddSection = async () => {
    if (!newSection.name) return;
    try {
      await apiPost('/api/sections', {
        name: newSection.name,
        description: newSection.description,
        order: Number.isFinite(newSection.order) ? newSection.order : 0,
      });
      setNewSection({ name: '', description: '', order: 0 });
      await fetchData();
    } catch (e) {
      console.error("Add section error:", e);
    }
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.content) return;
    try {
      await apiPost('/api/announcements', {
        content: newAnnouncement.content,
        link: newAnnouncement.link || null,
        active: newAnnouncement.active,
      });
      setNewAnnouncement({ content: '', link: '', active: true });
      await fetchData();
    } catch (e) {
      console.error("Add announcement error:", e);
    }
  };

  const toggleAnnouncement = async (ann: any) => {
    try {
      await apiPatch(`/api/announcements/${ann.id}`, { active: !ann.active });
      setData(prev => prev.map(a => a.id === ann.id ? { ...a, active: !ann.active } : a));
    } catch (e) {
      console.error("Toggle announcement error:", e);
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
        {[
          { id: 'reviews', label: '审核队列', icon: CheckCircle },
          { id: 'wiki', label: '百科管理', icon: Book },
          { id: 'music', label: '音乐管理', icon: MusicIcon },
          { id: 'posts', label: '帖子管理', icon: MessageSquare },
          { id: 'sections', label: '版块管理', icon: Layers },
          { id: 'announcements', label: '公告管理', icon: Megaphone },
          { id: 'galleries', label: '图集管理', icon: ImageIcon },
          { id: 'locks', label: '编辑锁', icon: Edit2 },
          { id: 'users', label: '用户管理', icon: Users },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={clsx(
              "px-8 py-4 rounded-3xl font-bold transition-all flex items-center gap-3 shadow-sm border",
              activeTab === tab.id 
                ? "bg-brand-primary text-gray-900 border-brand-primary" 
                : "bg-white text-gray-500 border-gray-100 hover:border-brand-primary/20"
            )}
          >
            <tab.icon size={20} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sections' && (
        <div className="mb-8 p-8 bg-brand-cream/30 rounded-[32px] border border-brand-primary/10">
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Plus size={20} /> 新增论坛版块
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input 
              type="text" 
              placeholder="版块名称"
              value={newSection.name}
              onChange={e => setNewSection({...newSection, name: e.target.value})}
              className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <input 
              type="text" 
              placeholder="描述"
              value={newSection.description}
              onChange={e => setNewSection({...newSection, description: e.target.value})}
              className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <input 
              type="number" 
              placeholder="排序"
              value={newSection.order}
              onChange={e => setNewSection({...newSection, order: parseInt(e.target.value)})}
              className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <button 
              onClick={handleAddSection}
              className="px-6 py-2 bg-brand-primary text-gray-900 rounded-xl font-bold hover:scale-105 transition-all"
            >
              添加版块
            </button>
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="mb-8 p-8 bg-brand-cream/30 rounded-[32px] border border-brand-primary/10">
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Plus size={20} /> 新增公告
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input 
              type="text" 
              placeholder="公告内容"
              value={newAnnouncement.content}
              onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
              className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20 col-span-2"
            />
            <input 
              type="text" 
              placeholder="跳转链接 (可选)"
              value={newAnnouncement.link}
              onChange={e => setNewAnnouncement({...newAnnouncement, link: e.target.value})}
              className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <button 
              onClick={handleAddAnnouncement}
              className="px-6 py-2 bg-brand-primary text-gray-900 rounded-xl font-bold hover:scale-105 transition-all"
            >
              发布公告
            </button>
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
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
                  onClick={() => setReviewFilter(item.id as 'all' | 'wiki' | 'posts')}
                  className={clsx(
                    'px-4 py-2 rounded-full text-xs font-bold transition-all',
                    reviewFilter === item.id
                      ? 'bg-brand-primary text-gray-900'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
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
                        <span className={clsx(
                          'px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider',
                          item.reviewType === 'wiki' ? 'bg-brand-cream text-brand-olive' : 'bg-brand-primary/10 text-brand-primary',
                        )}
                        >
                          {item.reviewType === 'wiki' ? '百科' : '帖子'}
                        </span>
                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                          待审核
                        </span>
                      </div>
                      <p className="font-bold text-gray-800 mb-1">{item.title || item.slug || item.id}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {(item.content || '').replace(/[#*`]/g, '').slice(0, 160) || '无内容摘要'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-2">
                        更新时间：{toDateValue(item.updatedAt) ? format(toDateValue(item.updatedAt)!, 'yyyy-MM-dd HH:mm') : 'N/A'}
                      </p>
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
            <div className="bg-white rounded-3xl border border-gray-100 py-16 text-center text-gray-400 italic">
              当前没有待审核内容
            </div>
          )}
        </div>
      )}

      {activeTab !== 'reviews' && (
      <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-cream/50 border-b border-gray-100">
                <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-brand-olive/60">内容详情</th>
                <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-brand-olive/60">状态/分类</th>
                <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-brand-olive/60">最后更新</th>
                <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-brand-olive/60 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-8 py-6"><div className="h-8 bg-gray-50 rounded-xl"></div></td>
                  </tr>
                ))
              ) : data.length > 0 ? data.map((item) => (
                <tr key={item.__entityId || item.id || item.uid || item.docId || item.slug} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      {activeTab === 'users' ? (
                        <img src={item.photoURL} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : activeTab === 'galleries' ? (
                        <img src={item.images?.[0]?.url} alt="" className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      ) : activeTab === 'locks' ? (
                        <div className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center text-brand-olive">
                          <Edit2 size={18} />
                        </div>
                      ) : activeTab === 'music' ? (
                        <img src={item.cover} alt="" className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center text-brand-olive">
                          {activeTab === 'wiki' ? <Book size={20} /> : <MessageSquare size={20} />}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-700">{item.title || item.displayName || item.slug || (activeTab === 'locks' ? `${item.collection}/${item.recordId}` : '')}</p>
                        <p className="text-xs text-gray-400 truncate max-w-xs">
                          {activeTab === 'locks'
                            ? `${item.username || item.userId} · 到期 ${toDateValue(item.expiresAt) ? format(toDateValue(item.expiresAt)!, 'MM-dd HH:mm') : 'N/A'}`
                            : item.content?.substring(0, 50) || item.email || item.description || item.artist}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-wrap gap-2">
                      <span className={clsx(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        item.role === 'super_admin' ? "bg-purple-100 text-purple-600" :
                        item.role === 'admin' ? "bg-red-100 text-red-600" : "bg-brand-cream text-brand-olive"
                      )}>
                        {item.role === 'super_admin' ? '超级管理员' : item.category || item.section || item.role || item.name || (activeTab === 'locks' ? item.collection : '默认')}
                      </span>
                      {activeTab === 'users' && (
                        <span className={clsx(
                          'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                          item.status === 'banned' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700',
                        )}>
                          {item.status === 'banned' ? '已封禁' : '正常'}
                        </span>
                      )}
                      {activeTab === 'locks' && (
                        <span className={clsx(
                          'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                          item.isExpired ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700',
                        )}>
                          {item.isExpired ? '已过期' : '有效'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-xs text-gray-400">
                    {toDateValue(item.updatedAt) ? format(toDateValue(item.updatedAt)!, 'yyyy-MM-dd HH:mm') : 
                     item.order !== undefined ? `排序: ${item.order}` : 'N/A'}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {activeTab === 'announcements' && (
                        <button 
                          onClick={() => toggleAnnouncement(item)}
                          className={clsx(
                            "p-2 rounded-lg transition-all",
                            item.active ? "text-green-500 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"
                          )}
                          title={item.active ? "禁用公告" : "启用公告"}
                        >
                          {item.active ? <CheckCircle size={18} /> : <XCircle size={18} />}
                        </button>
                      )}
                      {activeTab === 'users' && isSuperAdmin && (
                        <button 
                          onClick={() => toggleAdmin(item)}
                          className="p-2 text-brand-olive hover:bg-brand-cream rounded-lg transition-all"
                          title={item.role === 'admin' ? "取消管理员" : "设为管理员"}
                        >
                          {item.role === 'admin' ? <XCircle size={18} /> : <CheckCircle size={18} />}
                        </button>
                      )}
                      {activeTab === 'users' && item.uid !== user?.uid && (
                        <button
                          onClick={() => toggleUserBan(item)}
                          className={clsx(
                            'p-2 rounded-lg transition-all',
                            item.status === 'banned'
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-amber-600 hover:bg-amber-50',
                          )}
                          title={item.status === 'banned' ? '解封用户' : '封禁用户'}
                        >
                          {item.status === 'banned' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.__entityId || item.id || item.uid || item.docId || item.slug)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                        title="删除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-gray-400 italic">暂无数据</td>
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
