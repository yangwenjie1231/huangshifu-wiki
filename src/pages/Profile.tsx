import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Edit3, Save, X, Camera, Bookmark, FileText, MessageSquare, History } from 'lucide-react';
import { apiGet, apiPatch } from '../lib/apiClient';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { format } from 'date-fns';

type FavoriteTargetType = 'wiki' | 'post' | 'music';

type FavoriteItem = {
  id: string;
  targetType: FavoriteTargetType;
  targetId: string;
  createdAt: string;
  target: any;
};

type PostItem = {
  id: string;
  title: string;
  section: string;
  status: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
};

type CommentItem = {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string | null;
  content: string;
  parentId: string | null;
  createdAt: string;
  post: { id: string; title: string; status: string } | null;
};

type HistoryItem = {
  id: string;
  targetType: 'wiki' | 'post' | 'music';
  targetId: string;
  createdAt: string;
  target: { slug?: string; title?: string; id?: string; category?: string; status?: string; type?: string } | null;
};

type ActiveTab = 'profile' | 'favorites' | 'posts' | 'comments' | 'history';

const Profile = () => {
  const { user, profile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteFilter, setFavoriteFilter] = useState<'all' | FavoriteTargetType>('all');
  const [myPosts, setMyPosts] = useState<PostItem[]>([]);
  const [myComments, setMyComments] = useState<CommentItem[]>([]);
  const [myHistory, setMyHistory] = useState<HistoryItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || user?.displayName || '',
    bio: profile?.bio || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFormData({
      displayName: profile?.displayName || user.displayName || '',
      bio: profile?.bio || '',
      photoURL: profile?.photoURL || user.photoURL || '',
    });
  }, [profile?.displayName, profile?.bio, profile?.photoURL, user?.displayName, user?.photoURL, user?.uid]);

  useEffect(() => {
    if (!user || activeTab !== 'favorites') return;

    const run = async () => {
      setFavoritesLoading(true);
      try {
        const data = await apiGet<{ favorites: FavoriteItem[] }>('/api/users/me/favorites', {
          type: favoriteFilter === 'all' ? undefined : favoriteFilter,
        });
        setFavorites(data.favorites || []);
      } catch (error) {
        console.error('Error fetching favorites:', error);
      } finally {
        setFavoritesLoading(false);
      }
    };

    run();
  }, [user, activeTab, favoriteFilter]);

  useEffect(() => {
    if (!user || activeTab !== 'posts') return;

    const run = async () => {
      setPostsLoading(true);
      try {
        const data = await apiGet<{ posts: PostItem[]; total: number }>(`/api/users/${user.uid}/posts`, { limit: 50 });
        setMyPosts(data.posts || []);
      } catch (error) {
        console.error('Error fetching user posts:', error);
      } finally {
        setPostsLoading(false);
      }
    };

    run();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'comments') return;

    const run = async () => {
      setCommentsLoading(true);
      try {
        const data = await apiGet<{ comments: CommentItem[]; total: number }>(`/api/users/${user.uid}/comments`, { limit: 50 });
        setMyComments(data.comments || []);
      } catch (error) {
        console.error('Error fetching user comments:', error);
      } finally {
        setCommentsLoading(false);
      }
    };

    run();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'history') return;

    const run = async () => {
      setHistoryLoading(true);
      try {
        const data = await apiGet<{ history: HistoryItem[]; total: number }>('/api/users/me/history', { limit: 50 });
        setMyHistory(data.history || []);
      } catch (error) {
        console.error('Error fetching browsing history:', error);
      } finally {
        setHistoryLoading(false);
      }
    };

    run();
  }, [user, activeTab]);

  const groupedFavorites = useMemo(() => {
    return favorites.map((item) => {
      if (item.targetType === 'wiki') {
        return {
          ...item,
          href: `/wiki/${item.target?.slug || item.targetId}`,
          title: item.target?.title || item.targetId,
          subtitle: item.target?.category ? `分类：${item.target.category}` : '百科页面',
        };
      }
      if (item.targetType === 'post') {
        return {
          ...item,
          href: `/forum/${item.target?.id || item.targetId}`,
          title: item.target?.title || item.targetId,
          subtitle: item.target?.section ? `板块：${item.target.section}` : '社区帖子',
        };
      }
      return {
        ...item,
        href: '/music',
        title: item.target?.title || item.targetId,
        subtitle: item.target?.artist ? `${item.target.artist} · ${item.target.album || ''}` : '音乐内容',
      };
    });
  }, [favorites]);

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
      await apiPatch('/api/users/me', {
        displayName: formData.displayName,
        bio: formData.bio,
        photoURL: formData.photoURL,
      });
      setIsEditing(false);
    } catch (e) {
      console.error('Error updating profile:', e);
      alert('保存失败，请稍后重试');
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
                  onChange={(e) => setFormData({ ...formData, photoURL: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, photoURL: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
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
                      photoURL: profile?.photoURL || user.photoURL || '',
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

          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={clsx(
                'px-4 py-2 rounded-full text-xs font-bold transition-all',
                activeTab === 'profile' ? 'bg-brand-primary text-gray-900' : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
              )}
            >
              个人资料
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={clsx(
                'px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5',
                activeTab === 'posts' ? 'bg-brand-primary text-gray-900' : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
              )}
            >
              <FileText size={14} /> 我的帖子
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={clsx(
                'px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5',
                activeTab === 'comments' ? 'bg-brand-primary text-gray-900' : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
              )}
            >
              <MessageSquare size={14} /> 我的评论
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={clsx(
                'px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5',
                activeTab === 'history' ? 'bg-brand-primary text-gray-900' : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
              )}
            >
              <History size={14} /> 浏览历史
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={clsx(
                'px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5',
                activeTab === 'favorites' ? 'bg-brand-primary text-gray-900' : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
              )}
            >
              <Bookmark size={14} /> 我的收藏
            </button>
          </div>

          {activeTab === 'profile' ? (
            <>
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
                  <p className="text-xs text-brand-primary/60 font-bold uppercase tracking-widest mb-1">状态</p>
                  <p className={clsx(
                    'text-2xl font-serif font-bold uppercase',
                    profile?.status === 'banned' ? 'text-red-600' : 'text-gray-900',
                  )}>
                    {profile?.status === 'banned' ? 'Banned' : 'Active'}
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <section>
                  <h3 className="text-xl font-serif font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">个人简介</h3>
                  {isEditing ? (
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
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
              </div>
            </>
          ) : activeTab === 'posts' ? (
            <div className="space-y-4">
              {postsLoading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />
                ))
              ) : myPosts.length > 0 ? (
                myPosts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/forum/${post.id}`}
                    className="block p-4 bg-white rounded-2xl border border-gray-100 hover:border-brand-primary/20 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                            post.status === 'published'
                              ? 'bg-green-100 text-green-700'
                              : post.status === 'pending'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-600',
                          )}>
                            {post.status === 'published' ? '已发布' : post.status === 'pending' ? '待审核' : post.status}
                          </span>
                          <span className="text-xs text-gray-400">{post.section}</span>
                        </div>
                        <p className="font-bold text-gray-800 truncate">{post.title}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-400">{format(new Date(post.createdAt), 'MM-dd HH:mm')}</p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-gray-400 text-sm">暂无帖子</p>
                </div>
              )}
            </div>
          ) : activeTab === 'comments' ? (
            <div className="space-y-4">
              {commentsLoading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />
                ))
              ) : myComments.length > 0 ? (
                myComments.map((comment) => (
                  <div key={comment.id} className="p-4 bg-white rounded-2xl border border-gray-100 hover:border-brand-primary/20 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400">回复了</span>
                      {comment.post ? (
                        <Link to={`/forum/${comment.post.id}`} className="text-xs text-brand-primary font-medium hover:underline">
                          {comment.post.title}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">原帖子已删除</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">{comment.content}</p>
                    <p className="text-xs text-gray-400 mt-2">{format(new Date(comment.createdAt), 'MM-dd HH:mm')}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-gray-400 text-sm">暂无评论</p>
                </div>
              )}
            </div>
          ) : activeTab === 'history' ? (
            <div className="space-y-4">
              {historyLoading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />
                ))
              ) : myHistory.length > 0 ? (
                myHistory.map((item) => (
                  <Link
                    key={item.id}
                    to={item.targetType === 'wiki' ? `/wiki/${item.target?.slug || item.targetId}` : item.targetType === 'post' ? `/forum/${item.target?.id || item.targetId}` : '/music'}
                    className="block p-4 bg-white rounded-2xl border border-gray-100 hover:border-brand-primary/20 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                            item.targetType === 'wiki'
                              ? 'bg-brand-cream text-brand-olive'
                              : item.targetType === 'post'
                                ? 'bg-brand-primary/10 text-brand-primary'
                                : 'bg-gray-100 text-gray-600',
                          )}>
                            {item.targetType === 'wiki' ? '百科' : item.targetType === 'post' ? '帖子' : '音乐'}
                          </span>
                        </div>
                        <p className="font-bold text-gray-800 truncate">{item.target?.title || item.targetId}</p>
                        <p className="text-xs text-gray-500 truncate">{item.target?.category || (item.targetType === 'post' ? '社区帖子' : '')}</p>
                      </div>
                      <p className="text-xs text-gray-400 whitespace-nowrap">{format(new Date(item.createdAt), 'MM-dd HH:mm')}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-gray-400 text-sm">暂无浏览历史</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: '全部' },
                  { id: 'wiki', label: '百科' },
                  { id: 'post', label: '帖子' },
                  { id: 'music', label: '音乐' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFavoriteFilter(item.id as 'all' | FavoriteTargetType)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                      favoriteFilter === item.id
                        ? 'bg-brand-primary text-gray-900'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {favoritesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : groupedFavorites.length > 0 ? (
                <div className="space-y-3">
                  {groupedFavorites.map((item) => (
                    <Link
                      key={item.id}
                      to={item.href}
                      className="block p-4 bg-white rounded-2xl border border-gray-100 hover:border-brand-primary/20 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={clsx(
                              'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                              item.targetType === 'wiki'
                                ? 'bg-brand-cream text-brand-olive'
                                : item.targetType === 'post'
                                  ? 'bg-brand-primary/10 text-brand-primary'
                                  : 'bg-gray-100 text-gray-600',
                            )}>
                              {item.targetType === 'wiki' ? '百科' : item.targetType === 'post' ? '帖子' : '音乐'}
                            </span>
                          </div>
                          <p className="font-bold text-gray-800 truncate">{item.title}</p>
                          <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                        </div>
                        <p className="text-[10px] text-gray-400 whitespace-nowrap">{item.createdAt?.slice(0, 10)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-gray-400 text-sm">暂无收藏内容</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
