import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, deleteDoc, updateDoc, orderBy, limit, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Shield, Book, MessageSquare, Image as ImageIcon, Users, Trash2, CheckCircle, XCircle, AlertTriangle, ChevronRight, Layers, Plus, Save, Edit2, Megaphone, Music as MusicIcon } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

const Admin = () => {
  const { user, profile, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'wiki' | 'posts' | 'galleries' | 'users' | 'sections' | 'announcements' | 'music'>('wiki');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSection, setNewSection] = useState({ name: '', description: '', order: 0 });
  const [newAnnouncement, setNewAnnouncement] = useState({ content: '', link: '', active: true });
  const [editingSection, setEditingSection] = useState<string | null>(null);

  const isSuperAdmin = profile?.role === 'super_admin' || user?.email === 'yangwenjie1231@gmail.com';

  const fetchData = async () => {
    setLoading(true);
    try {
      const colRef = collection(db, activeTab);
      let q;
      if (activeTab === 'users') {
        q = query(colRef, limit(100));
      } else if (activeTab === 'sections' || activeTab === 'announcements') {
        q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
      } else {
        q = query(colRef, orderBy('updatedAt', 'desc'), limit(100));
      }
      const snapshot = await getDocs(q);
      setData(snapshot.docs.map(doc => ({ ...(doc.data() as any), docId: doc.id })));
    } catch (e) {
      console.error("Error fetching admin data:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除这项内容吗？此操作不可撤销。")) return;
    try {
      await deleteDoc(doc(db, activeTab, id));
      setData(prev => prev.filter(item => item.docId !== id && item.uid !== id));
    } catch (e) {
      console.error("Delete error:", e);
      alert("删除失败");
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
      await updateDoc(doc(db, 'users', targetUser.uid), { role: newRole });
      setData(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, role: newRole } : u));
    } catch (e) {
      console.error("Update role error:", e);
      alert("更新角色失败");
    }
  };

  const handleAddSection = async () => {
    if (!newSection.name) return;
    try {
      const id = newSection.name.toLowerCase().replace(/\s+/g, '-');
      await setDoc(doc(db, 'sections', id), { ...newSection, id, createdAt: serverTimestamp() });
      setNewSection({ name: '', description: '', order: 0 });
      fetchData();
    } catch (e) {
      console.error("Add section error:", e);
    }
  };

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.content) return;
    try {
      await addDoc(collection(db, 'announcements'), {
        ...newAnnouncement,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewAnnouncement({ content: '', link: '', active: true });
      fetchData();
    } catch (e) {
      console.error("Add announcement error:", e);
    }
  };

  const toggleAnnouncement = async (ann: any) => {
    try {
      await updateDoc(doc(db, 'announcements', ann.id), { active: !ann.active });
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
          { id: 'wiki', label: '百科管理', icon: Book },
          { id: 'music', label: '音乐管理', icon: MusicIcon },
          { id: 'posts', label: '帖子管理', icon: MessageSquare },
          { id: 'sections', label: '版块管理', icon: Layers },
          { id: 'announcements', label: '公告管理', icon: Megaphone },
          { id: 'galleries', label: '图集管理', icon: ImageIcon },
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
                <tr key={item.docId || item.uid} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      {activeTab === 'users' ? (
                        <img src={item.photoURL} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : activeTab === 'galleries' ? (
                        <img src={item.images?.[0]?.url} alt="" className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      ) : activeTab === 'music' ? (
                        <img src={item.cover} alt="" className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center text-brand-olive">
                          {activeTab === 'wiki' ? <Book size={20} /> : <MessageSquare size={20} />}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-700">{item.title || item.displayName || item.slug}</p>
                        <p className="text-xs text-gray-400 truncate max-w-xs">{item.content?.substring(0, 50) || item.email || item.description || item.artist}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={clsx(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      item.role === 'super_admin' ? "bg-purple-100 text-purple-600" :
                      item.role === 'admin' ? "bg-red-100 text-red-600" : "bg-brand-cream text-brand-olive"
                    )}>
                      {item.role === 'super_admin' ? '超级管理员' : item.category || item.section || item.role || item.name || '默认'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-xs text-gray-400">
                    {item.updatedAt?.toDate ? format(item.updatedAt.toDate(), 'yyyy-MM-dd HH:mm') : 
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
                      <button 
                        onClick={() => handleDelete(item.docId || item.uid)}
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
    </div>
  );
};

export default Admin;
