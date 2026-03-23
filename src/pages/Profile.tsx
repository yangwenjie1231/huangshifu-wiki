import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Calendar, Edit3, Save, X, Camera } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const Profile = () => {
  const { user, profile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || user?.displayName || '',
    bio: profile?.bio || '',
    photoURL: profile?.photoURL || user?.photoURL || ''
  });
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 italic">请先登录以查看个人资料</p>
      </div>
    );
  }

  const handleSave = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: formData.displayName,
        bio: formData.bio,
        photoURL: formData.photoURL
      });
      setIsEditing(false);
    } catch (e) {
      console.error("Error updating profile:", e);
      alert("保存失败，请稍后重试");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-[40px] overflow-hidden border border-gray-100 shadow-sm">
        <div className="h-48 bg-brand-primary/10 relative">
          <div className="absolute -bottom-12 left-12 group">
            <img 
              src={formData.photoURL || 'https://picsum.photos/seed/user/200/200'} 
              alt="" 
              className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover"
              referrerPolicy="no-referrer"
            />
            {isEditing && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="text-white" size={24} />
                <input 
                  type="text"
                  value={formData.photoURL}
                  onChange={e => setFormData({...formData, photoURL: e.target.value})}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  title="粘贴图片链接"
                />
              </div>
            )}
          </div>
        </div>
        
        <div className="pt-16 pb-12 px-12">
          {isEditing && (
            <div className="mb-6 p-4 bg-brand-cream rounded-2xl border border-brand-primary/10">
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">头像链接</p>
              <input 
                type="text"
                value={formData.photoURL}
                onChange={e => setFormData({...formData, photoURL: e.target.value})}
                className="w-full px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-brand-primary/20 text-sm"
                placeholder="粘贴头像图片 URL..."
              />
            </div>
          )}
          <div className="flex justify-between items-start mb-8">
            <div className="flex-grow mr-4">
              {isEditing ? (
                <input 
                  type="text"
                  value={formData.displayName}
                  onChange={e => setFormData({...formData, displayName: e.target.value})}
                  className="text-4xl font-serif font-bold text-gray-900 mb-2 bg-brand-cream px-4 py-1 rounded-xl w-full border-none focus:ring-2 focus:ring-brand-primary/20"
                  placeholder="输入昵称..."
                />
              ) : (
                <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">{profile?.displayName || user.displayName}</h1>
              )}
              <p className="text-gray-400 flex items-center gap-1.5 text-sm">
                <Mail size={14} /> {user.email}
              </p>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={24} />
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="px-6 py-2 bg-brand-primary text-gray-900 rounded-full text-sm font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                  >
                    <Save size={16} /> {loading ? '保存中...' : '保存'}
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => {
                    setFormData({
                      displayName: profile?.displayName || user.displayName || '',
                      bio: profile?.bio || '',
                      photoURL: profile?.photoURL || user.photoURL || ''
                    });
                    setIsEditing(true);
                  }}
                  className="px-6 py-2 border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                  <Edit3 size={16} /> 编辑资料
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 bg-brand-cream rounded-3xl">
              <p className="text-xs text-brand-primary/60 font-bold uppercase tracking-widest mb-1">等级</p>
              <p className="text-2xl font-serif font-bold">Lv.{profile?.level || 1}</p>
            </div>
            <div className="p-6 bg-brand-cream rounded-3xl">
              <p className="text-xs text-brand-primary/60 font-bold uppercase tracking-widest mb-1">身份</p>
              <p className="text-2xl font-serif font-bold uppercase">{profile?.role || 'User'}</p>
            </div>
            <div className="p-6 bg-brand-cream rounded-3xl">
              <p className="text-xs text-brand-primary/60 font-bold uppercase tracking-widest mb-1">加入时间</p>
              <p className="text-2xl font-serif font-bold">2026.03</p>
            </div>
          </div>

          <div className="space-y-8">
            <section>
              <h3 className="text-xl font-serif font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">个人简介</h3>
              {isEditing ? (
                <textarea 
                  value={formData.bio}
                  onChange={e => setFormData({...formData, bio: e.target.value})}
                  rows={4}
                  className="w-full px-6 py-4 bg-brand-cream rounded-3xl border-none focus:ring-2 focus:ring-brand-primary/20 font-body italic leading-relaxed resize-none"
                  placeholder="写点什么介绍一下自己吧..."
                />
              ) : (
                <p className="text-gray-600 italic leading-relaxed">
                  {profile?.bio || '这位粉丝很神秘，还没有写下任何简介...'}
                </p>
              )}
            </section>
            
            <section>
              <h3 className="text-xl font-serif font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">活跃记录</h3>
              <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">暂无发帖或评论记录</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
