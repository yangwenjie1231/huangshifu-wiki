import React from 'react';
import { NavLink } from 'react-router-dom';
import { Music, Book, MessageSquare, Image as ImageIcon, Search, Home } from 'lucide-react';
import { clsx } from 'clsx';

export const BottomNav = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-gray-100 pb-safe">
      <div className="flex justify-around items-center h-16">
        <NavLink 
          to="/" 
          className={({ isActive }) => clsx(
            "flex flex-col items-center gap-1 transition-all",
            isActive ? "text-brand-olive scale-110" : "text-gray-400"
          )}
        >
          <Home size={20} />
          <span className="text-[10px] font-bold uppercase tracking-widest">首页</span>
        </NavLink>
        
        <NavLink 
          to="/wiki" 
          className={({ isActive }) => clsx(
            "flex flex-col items-center gap-1 transition-all",
            isActive ? "text-brand-olive scale-110" : "text-gray-400"
          )}
        >
          <Book size={20} />
          <span className="text-[10px] font-bold uppercase tracking-widest">百科</span>
        </NavLink>

        <NavLink 
          to="/forum" 
          className={({ isActive }) => clsx(
            "flex flex-col items-center gap-1 transition-all",
            isActive ? "text-brand-olive scale-110" : "text-gray-400"
          )}
        >
          <MessageSquare size={20} />
          <span className="text-[10px] font-bold uppercase tracking-widest">社区</span>
        </NavLink>

        <NavLink 
          to="/gallery" 
          className={({ isActive }) => clsx(
            "flex flex-col items-center gap-1 transition-all",
            isActive ? "text-brand-olive scale-110" : "text-gray-400"
          )}
        >
          <ImageIcon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-widest">图集</span>
        </NavLink>

        <NavLink 
          to="/music" 
          className={({ isActive }) => clsx(
            "flex flex-col items-center gap-1 transition-all",
            isActive ? "text-brand-olive scale-110" : "text-gray-400"
          )}
        >
          <Music size={20} />
          <span className="text-[10px] font-bold uppercase tracking-widest">音乐</span>
        </NavLink>
      </div>
    </nav>
  );
};
