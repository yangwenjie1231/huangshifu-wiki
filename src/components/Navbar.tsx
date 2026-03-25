import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Music, Book, MessageSquare, User as UserIcon, LogIn, LogOut, Shield, Image as ImageIcon, Search, MessageCircle, Menu, X, Bell } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { login, register, logoutRequest, loginWithWeChat } from '../lib/auth';
import { apiGet, apiPost } from '../lib/apiClient';

interface NotificationItem {
  id: string;
  type: 'reply' | 'like' | 'review_result';
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

interface ReviewNotificationPayload {
  approved?: boolean;
  targetType?: 'wiki' | 'post';
  targetId?: string;
  title?: string;
  note?: string | null;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

interface WechatLoginResponse {
  token?: string;
  wechat?: {
    openId?: string;
    unionId?: string | null;
  };
}

type AuthMode = 'login' | 'register' | 'wechat';

export const Navbar = () => {
  const { user, profile, isAdmin, isBanned } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<AuthMode>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [wechatCode, setWechatCode] = React.useState('');
  const [wechatPhotoURL, setWechatPhotoURL] = React.useState('');
  const [authLoading, setAuthLoading] = React.useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifLoading, setNotifLoading] = React.useState(false);

  const fetchNotifications = React.useCallback(async () => {
    if (!user) return;
    try {
      setNotifLoading(true);
      const data = await apiGet<NotificationsResponse>('/api/notifications', { limit: 10 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Fetch notifications error:', error);
    } finally {
      setNotifLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  const markNotificationRead = async (id: string) => {
    try {
      await apiPost('/api/notifications/' + id + '/read');
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Mark notification read error:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await apiPost('/api/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Mark all notifications read error:', error);
    }
  };

  const getNotificationText = (notif: NotificationItem) => {
    switch (notif.type) {
      case 'reply':
        return '回复了你的' + (notif.payload.parentId ? '评论' : '帖子');
      case 'like':
        return '赞了你的帖子';
      case 'review_result':
        const payload = notif.payload as ReviewNotificationPayload;
        const target = payload.targetType === 'wiki' ? '百科' : payload.targetType === 'post' ? '帖子' : '内容';
        const title = typeof payload.title === 'string' && payload.title.trim() ? `《${payload.title}》` : '';
        const base = payload.approved === true ? `已通过你的${target}编辑审核` : `已驳回你的${target}编辑审核`;
        if (payload.approved === true) {
          return `${base}${title ? `：${title}` : ''}`;
        }
        const note = typeof payload.note === 'string' ? payload.note.trim() : '';
        return `${base}${title ? `：${title}` : ''}${note ? `（原因：${note}）` : ''}`;
      default:
        return '有新通知';
    }
  };

  const openNotificationsPage = () => {
    setNotifPanelOpen(false);
    setIsMenuOpen(false);
    navigate('/notifications');
  };

  const getNotificationLink = (notif: NotificationItem) => {
    if (notif.type === 'reply' || notif.type === 'like') {
      const postId = typeof notif.payload.postId === 'string' ? notif.payload.postId : null;
      return postId ? `/forum/${postId}` : null;
    }

    if (notif.type === 'review_result') {
      const payload = notif.payload as ReviewNotificationPayload;
      if (payload.targetType === 'wiki' && typeof payload.targetId === 'string') {
        return `/wiki/${payload.targetId}`;
      }
      if (payload.targetType === 'post' && typeof payload.targetId === 'string') {
        return `/forum/${payload.targetId}`;
      }
    }

    return null;
  };

  const openAuthModal = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'wechat') {
      if (!wechatCode.trim()) return;
    } else if (!email || !password) {
      return;
    }

    try {
      setAuthLoading(true);
      if (authMode === 'login') {
        await login(email, password);
      } else if (authMode === 'register') {
        await register(email, password, displayName || email.split('@')[0] || '匿名用户');
      } else {
        const result = await loginWithWeChat<WechatLoginResponse>(wechatCode, {
          displayName: displayName || undefined,
          photoURL: wechatPhotoURL || undefined,
        });
        if (result.token) {
          localStorage.setItem('mp_auth_token', result.token);
        }
        if (result.wechat?.openId) {
          localStorage.setItem('mp_open_id', result.wechat.openId);
        }
      }
      setAuthModalOpen(false);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setWechatCode('');
      setWechatPhotoURL('');
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Auth failed:', error);
      alert(error instanceof Error ? error.message : '登录失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutRequest();
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
      alert('退出登录失败，请稍后重试');
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-brand-paper/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-full bg-brand-olive flex items-center justify-center text-white font-serif italic text-xl">
                诗
              </div>
              <span className="font-serif text-2xl font-semibold tracking-tight text-brand-olive">诗扶小筑</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-6">
              <NavLink to="/wiki" className={({ isActive }) => clsx("flex items-center gap-1.5 text-sm font-medium transition-colors", isActive ? "text-brand-olive" : "text-gray-500 hover:text-brand-olive")}>
                <Book size={18} />
                百科
              </NavLink>
              <NavLink to="/forum" className={({ isActive }) => clsx("flex items-center gap-1.5 text-sm font-medium transition-colors", isActive ? "text-brand-olive" : "text-gray-500 hover:text-brand-olive")}>
                <MessageSquare size={18} />
                社区
              </NavLink>
              <NavLink to="/gallery" className={({ isActive }) => clsx("flex items-center gap-1.5 text-sm font-medium transition-colors", isActive ? "text-brand-olive" : "text-gray-500 hover:text-brand-olive")}>
                <ImageIcon size={18} />
                图集
              </NavLink>
              <NavLink to="/music" className={({ isActive }) => clsx("flex items-center gap-1.5 text-sm font-medium transition-colors", isActive ? "text-brand-olive" : "text-gray-500 hover:text-brand-olive")}>
                <Music size={18} />
                音乐
              </NavLink>
              <NavLink to="/search" className={({ isActive }) => clsx("flex items-center gap-1.5 text-sm font-medium transition-colors", isActive ? "text-brand-olive" : "text-gray-500 hover:text-brand-olive")}>
                <Search size={18} />
                搜索
              </NavLink>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  {isBanned && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-50 text-red-600">
                      账号受限
                    </span>
                  )}
                  {isAdmin && (
                    <Link to="/admin" className="text-gray-500 hover:text-brand-olive">
                      <Shield size={20} />
                    </Link>
                  )}
                  {user && (
                    <div className="relative">
                      <button
                        onClick={() => setNotifPanelOpen(!notifPanelOpen)}
                        className="relative text-gray-500 hover:text-brand-olive transition-colors"
                      >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </button>
                      <AnimatePresence>
                        {notifPanelOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setNotifPanelOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: -8, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden"
                            >
                              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <span className="font-bold text-gray-900">通知</span>
                                <div className="flex items-center gap-3">
                                  {unreadCount > 0 && (
                                    <button
                                      onClick={markAllNotificationsRead}
                                      className="text-xs text-brand-olive hover:underline"
                                    >
                                      全部已读
                                    </button>
                                  )}
                                  <button
                                    onClick={openNotificationsPage}
                                    className="text-xs text-brand-olive hover:underline"
                                  >
                                    查看全部
                                  </button>
                                </div>
                              </div>
                              <div className="max-h-80 overflow-y-auto">
                                {notifLoading ? (
                                  <div className="py-8 text-center text-sm text-gray-400">加载中...</div>
                                ) : notifications.length === 0 ? (
                                  <div className="py-8 text-center text-sm text-gray-400">暂无通知</div>
                                ) : (
                                  notifications.map((notif) => (
                                    <button
                                      key={notif.id}
                                      onClick={() => {
                                        if (!notif.isRead) markNotificationRead(notif.id);
                                        const link = getNotificationLink(notif);
                                        if (link) {
                                          navigate(link);
                                        }
                                        setNotifPanelOpen(false);
                                      }}
                                      className={clsx(
                                        'w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                                        !notif.isRead && 'bg-blue-50/50'
                                      )}
                                    >
                                      <p className={clsx('text-sm', !notif.isRead ? 'font-medium text-gray-900' : 'text-gray-600')}>
                                        {getNotificationText(notif)}
                                      </p>
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        {new Date(notif.createdAt).toLocaleString('zh-CN')}
                                      </p>
                                    </button>
                                  ))
                                )}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  <Link to="/profile" className="flex items-center gap-2 group">
                    <img src={profile?.photoURL || user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                    <span className="hidden sm:inline text-sm font-medium text-gray-700 group-hover:text-brand-olive">{profile?.displayName || user.displayName}</span>
                  </Link>
                  <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors">
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openAuthModal('register')}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-all shadow-sm"
                  >
                    <MessageCircle size={18} />
                    账号注册
                  </button>
                  <button 
                    onClick={() => openAuthModal('login')}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-olive text-white text-sm font-medium hover:bg-brand-olive/90 transition-all shadow-sm"
                  >
                    <LogIn size={18} />
                    账号登录
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-500 hover:text-brand-olive transition-colors"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-gray-100 overflow-hidden"
          >
            <div className="px-4 py-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <NavLink to="/wiki" onClick={() => setIsMenuOpen(false)} className="flex flex-col items-center gap-2 p-4 bg-brand-cream/30 rounded-2xl text-brand-olive">
                  <Book size={24} />
                  <span className="text-xs font-bold">百科</span>
                </NavLink>
                <NavLink to="/forum" onClick={() => setIsMenuOpen(false)} className="flex flex-col items-center gap-2 p-4 bg-brand-cream/30 rounded-2xl text-brand-olive">
                  <MessageSquare size={24} />
                  <span className="text-xs font-bold">社区</span>
                </NavLink>
                <NavLink to="/gallery" onClick={() => setIsMenuOpen(false)} className="flex flex-col items-center gap-2 p-4 bg-brand-cream/30 rounded-2xl text-brand-olive">
                  <ImageIcon size={24} />
                  <span className="text-xs font-bold">图集</span>
                </NavLink>
                <NavLink to="/music" onClick={() => setIsMenuOpen(false)} className="flex flex-col items-center gap-2 p-4 bg-brand-cream/30 rounded-2xl text-brand-olive">
                  <Music size={24} />
                  <span className="text-xs font-bold">音乐</span>
                </NavLink>
              </div>

              <div className="pt-4 border-t border-gray-100">
                {user ? (
                  <div className="space-y-4">
                    {isBanned && (
                      <div className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs">
                        账号已封禁{profile?.banReason ? `：${profile.banReason}` : ''}
                      </div>
                    )}
                    <Link to="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-2">
                      <img src={profile?.photoURL || user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                      <div>
                        <p className="font-bold text-gray-900">{profile?.displayName || user.displayName}</p>
                        <p className="text-xs text-gray-400">查看个人资料</p>
                      </div>
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-gray-600">
                        <Shield size={20} />
                        <span className="text-sm font-medium">管理后台</span>
                      </Link>
                    )}
                    <button 
                      onClick={() => {
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-red-50 text-red-500 rounded-xl"
                    >
                      <LogOut size={20} />
                      <span className="text-sm font-medium">退出登录</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button 
                      onClick={() => {
                        openAuthModal('register');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-green-500 text-white rounded-2xl font-bold"
                    >
                      <MessageCircle size={20} />
                      账号注册
                    </button>
                    <button 
                      onClick={() => {
                        openAuthModal('login');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-brand-olive text-white rounded-2xl font-bold"
                    >
                      <LogIn size={20} />
                      账号登录
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {authModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-serif font-bold text-brand-olive">
                  {authMode === 'wechat' ? '微信登录' : authMode === 'login' ? '账号登录' : '账号注册'}
                </h3>
                <button
                  onClick={() => setAuthModalOpen(false)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {(authMode === 'register' || authMode === 'wechat') && (
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={authMode === 'wechat' ? '微信昵称（可选）' : '昵称（可选）'}
                    className="w-full px-4 py-3 bg-brand-cream rounded-xl border-none focus:ring-2 focus:ring-brand-olive/20"
                  />
                )}
                {authMode === 'wechat' ? (
                  <>
                    <input
                      type="text"
                      required
                      value={wechatCode}
                      onChange={(e) => setWechatCode(e.target.value)}
                      placeholder="小程序 wx.login code"
                      className="w-full px-4 py-3 bg-brand-cream rounded-xl border-none focus:ring-2 focus:ring-brand-olive/20"
                    />
                    <input
                      type="url"
                      value={wechatPhotoURL}
                      onChange={(e) => setWechatPhotoURL(e.target.value)}
                      placeholder="头像 URL（可选）"
                      className="w-full px-4 py-3 bg-brand-cream rounded-xl border-none focus:ring-2 focus:ring-brand-olive/20"
                    />
                    <p className="text-xs text-gray-500 leading-relaxed">
                      开发环境可使用 mock code：`mock:openId` 或 `mock:openId:unionId`。
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="邮箱"
                      className="w-full px-4 py-3 bg-brand-cream rounded-xl border-none focus:ring-2 focus:ring-brand-olive/20"
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="密码（至少 6 位）"
                      className="w-full px-4 py-3 bg-brand-cream rounded-xl border-none focus:ring-2 focus:ring-brand-olive/20"
                    />
                  </>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full px-4 py-3 bg-brand-olive text-white rounded-xl font-bold hover:bg-brand-olive/90 transition-all disabled:opacity-50"
                >
                  {authLoading
                    ? (authMode === 'login' ? '登录中...' : authMode === 'register' ? '注册中...' : '登录中...')
                    : (authMode === 'login' ? '登录' : authMode === 'register' ? '注册' : '微信登录')}
                </button>
              </form>

              <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                <button
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="font-medium text-brand-olive hover:underline"
                >
                  {authMode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
                </button>
                <button
                  onClick={() => setAuthMode(authMode === 'wechat' ? 'login' : 'wechat')}
                  className="font-medium text-brand-olive hover:underline"
                >
                  {authMode === 'wechat' ? '改用账号密码' : '改用微信登录'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
