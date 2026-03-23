import React, { useState, useEffect } from 'react';
import { Megaphone, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export const AnnouncementBar = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [announcement, setAnnouncement] = useState<any>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'announcements'),
      where('active', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setAnnouncement({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setAnnouncement(null);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!isVisible || !announcement) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-brand-primary text-gray-900 py-2 px-4 relative overflow-hidden"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
          <Megaphone size={16} className="animate-bounce" />
          <p className="text-sm font-bold truncate pr-8">
            {announcement.content}
          </p>
          {announcement.link && (
            <a 
              href={announcement.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-bold hover:underline"
            >
              立即查看 <ChevronRight size={14} />
            </a>
          )}
        </div>
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded-full transition-colors"
        >
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
