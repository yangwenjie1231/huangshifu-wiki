import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginWithGoogle, loginWithWeChat, logout } from '../firebase';
import { Music, Book, MessageSquare, User as UserIcon, LogIn, LogOut, Shield, Image as ImageIcon, Search, MessageCircle } from 'lucide-react';
import { clsx } from 'clsx';

export const Navbar = () => {
  const { user, profile, isAdmin } = useAuth();

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
            {user ? (
              <div className="flex items-center gap-4">
                {isAdmin && (
                  <Link to="/admin" className="text-gray-500 hover:text-brand-olive">
                    <Shield size={20} />
                  </Link>
                )}
                <Link to="/profile" className="flex items-center gap-2 group">
                  <img src={profile?.photoURL || user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                  <span className="hidden sm:inline text-sm font-medium text-gray-700 group-hover:text-brand-olive">{profile?.displayName || user.displayName}</span>
                </Link>
                <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors">
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={loginWithWeChat}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-all shadow-sm"
                >
                  <MessageCircle size={18} />
                  微信登录
                </button>
                <button 
                  onClick={loginWithGoogle}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-olive text-white text-sm font-medium hover:bg-brand-olive/90 transition-all shadow-sm"
                >
                  <LogIn size={18} />
                  Google 登录
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
