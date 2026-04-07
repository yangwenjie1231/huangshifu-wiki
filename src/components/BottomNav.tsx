import React from 'react';
import { NavLink } from 'react-router-dom';
import { Music, Book, MessageSquare, Image as ImageIcon, Search, Home } from 'lucide-react';
import { clsx } from 'clsx';
import { useTheme } from '../context/ThemeContext';
import { withThemeSearch } from '../lib/theme';

export const BottomNav = () => {
  const { theme } = useTheme();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-100/50 pb-safe safe-area-bottom">
      <div className="flex justify-around items-center h-16">
        <NavLink 
          to={withThemeSearch('/', theme)} 
          className={({ isActive }) => clsx(
            "flex flex-col items-center justify-center gap-0.5 transition-all duration-200 touch-target-lg",
            isActive ? "text-brand-olive scale-110" : "text-gray-400"
          )}
        >
          <Home size={22} />
          <span className="text-[10px] font-bold uppercase tracking-wider">首页</span>
        </NavLink>
        
        <NavLink 
          to={withThemeSearch('/wiki', theme)} 
          className={({ isActive }) => clsx(
            "flex flex-col items-center justify-center gap-0.5 transition-all duration-200 touch-target-lg",
            isActive ? "text-brand-olive" : "text-gray-400"
          )}
        >
          <Book size={22} />
          <span className="text-[10px] font-bold uppercase tracking-wider">百科</span>
        </NavLink>

        <NavLink 
          to={withThemeSearch('/forum', theme)} 
          className={({ isActive }) => clsx(
            "flex flex-col items-center justify-center gap-0.5 transition-all duration-200 touch-target-lg",
            isActive ? "text-brand-olive" : "text-gray-400"
          )}
        >
          <MessageSquare size={22} />
          <span className="text-[10px] font-bold uppercase tracking-wider">社区</span>
        </NavLink>

        <NavLink 
          to={withThemeSearch('/gallery', theme)} 
          className={({ isActive }) => clsx(
            "flex flex-col items-center justify-center gap-0.5 transition-all duration-200 touch-target-lg",
            isActive ? "text-brand-olive" : "text-gray-400"
          )}
        >
          <ImageIcon size={22} />
          <span className="text-[10px] font-bold uppercase tracking-wider">图集</span>
        </NavLink>

        <NavLink 
          to={withThemeSearch('/music', theme)} 
          className={({ isActive }) => clsx(
            "flex flex-col items-center justify-center gap-0.5 transition-all duration-200 touch-target-lg",
            isActive ? "text-brand-olive" : "text-gray-400"
          )}
        >
          <Music size={22} />
          <span className="text-[10px] font-bold uppercase tracking-wider">音乐</span>
        </NavLink>

        <NavLink 
          to={withThemeSearch('/search', theme)} 
          className={({ isActive }) => clsx(
            "flex flex-col items-center justify-center gap-0.5 transition-all duration-200 touch-target-lg",
            isActive ? "text-brand-olive" : "text-gray-400"
          )}
        >
          <Search size={22} />
          <span className="text-[10px] font-bold uppercase tracking-wider">搜索</span>
        </NavLink>
      </div>
    </nav>
  );
};
