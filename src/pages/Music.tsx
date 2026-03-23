import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, setDoc, serverTimestamp, orderBy, addDoc, limit, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { Music as MusicIcon, Search, Plus, Play, Pause, Disc, List, Trash2, Heart, ExternalLink, Sparkles, ChevronRight, Volume2, Headphones, X } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { MusicPlayer } from '../components/MusicPlayer';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const Music = () => {
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { user, isAdmin } = useAuth();
  const { currentSong, setCurrentSong, setIsPlaying } = useMusic();

  const fetchSongs = async () => {
    setLoading(true);
    const path = 'music';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setSongs(snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id })));
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const handleAddSong = async () => {
    if (!searchId) return;
    
    // Extract ID from URL if needed
    let id = searchId;
    if (searchId.includes('id=')) {
      id = searchId.split('id=')[1].split('&')[0];
    }

    try {
      const response = await fetch(`/api/music/song/${id}`);
      const metadata = await response.json();
      
      if (metadata.error) {
        alert("无法获取歌曲信息，请检查 ID 是否正确");
        return;
      }

      const path = 'music';
      try {
        await addDoc(collection(db, path), {
          ...metadata,
          addedBy: user?.uid,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, path);
      }

      setSearchId('');
      setIsAdding(false);
      fetchSongs();
    } catch (e) {
      console.error("Error adding song:", e);
      alert("添加失败");
    }
  };

  const playSong = (song: any) => {
    setCurrentSong(song);
    setIsPlaying(true);
  };

  const handleDeleteSong = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    if (!window.confirm("确定要删除这首歌曲吗？")) return;
    
    const path = 'music';
    try {
      await deleteDoc(doc(db, path, songId));
      fetchSongs();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-primary text-gray-900 rounded-xl shadow-lg">
              <Headphones size={24} />
            </div>
            <h1 className="text-5xl font-serif font-bold text-gray-900">音乐馆</h1>
          </div>
          <p className="text-gray-500 italic">诗扶之声 · 记录每一首动人的旋律</p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="px-8 py-4 bg-gray-900 text-white rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-xl"
          >
            {isAdding ? <X size={20} /> : <Plus size={20} />}
            {isAdding ? '取消添加' : '添加音乐'}
          </button>
        )}
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-12 p-8 bg-brand-cream/30 rounded-[40px] border border-brand-primary/10"
          >
            <h3 className="text-xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Sparkles size={20} className="text-brand-primary" /> 输入网易云音乐 ID 或链接
            </h3>
            <div className="flex gap-4">
              <input 
                type="text" 
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                placeholder="例如: 1335942780 或 https://music.163.com/song?id=1335942780"
                className="flex-grow px-6 py-4 bg-white rounded-3xl border-none focus:ring-2 focus:ring-brand-primary/20 shadow-sm"
              />
              <button 
                onClick={handleAddSong}
                className="px-10 py-4 bg-brand-primary text-gray-900 rounded-3xl font-bold hover:scale-105 transition-all shadow-md"
              >
                获取并添加
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
                <List size={24} className="text-brand-primary" /> 播放列表
              </h2>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{songs.length} 首歌曲</span>
            </div>
            
            <div className="divide-y divide-gray-50">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="p-6 animate-pulse flex gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                    <div className="flex-grow space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/4" />
                    </div>
                  </div>
                ))
              ) : songs.length > 0 ? songs.map((song, index) => (
                <div 
                  key={song.docId}
                  onClick={() => playSong(song)}
                  className={clsx(
                    "p-6 flex items-center gap-4 hover:bg-gray-50 transition-all cursor-pointer group",
                    currentSong?.docId === song.docId && "bg-brand-primary/5"
                  )}
                >
                  <span className="text-xs font-bold text-gray-300 w-4">{index + 1}</span>
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md">
                    <img src={song.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {currentSong?.docId === song.docId && (
                      <div className="absolute inset-0 bg-brand-primary/40 flex items-center justify-center">
                        <Play size={16} className="text-gray-900 fill-current" />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-bold text-gray-900 group-hover:text-brand-primary transition-colors">{song.title}</h4>
                    <p className="text-xs text-gray-400">{song.artist} — {song.album}</p>
                  </div>
                  <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isAdmin && (
                      <button 
                        onClick={(e) => handleDeleteSong(e, song.docId)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="删除歌曲"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                      <Heart size={18} />
                    </button>
                    <a 
                      href={`https://music.163.com/song?id=${song.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-brand-primary transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink size={18} />
                    </a>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center text-gray-400 italic">暂无音乐，快去添加吧</div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Disc size={24} className="text-brand-primary" /> 正在播放
            </h2>
            {currentSong ? (
              <MusicPlayer songId={currentSong.id} />
            ) : (
              <div className="bg-white rounded-[40px] p-12 border border-gray-100 shadow-sm text-center">
                <div className="w-20 h-20 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-6 text-brand-primary">
                  <MusicIcon size={40} />
                </div>
                <p className="text-gray-400 italic">选择一首歌曲开始播放</p>
              </div>
            )}
            
            <div className="mt-8 p-8 bg-gray-900 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Sparkles size={120} />
              </div>
              <h3 className="text-xl font-serif font-bold mb-4 relative z-10">音乐小贴士</h3>
              <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                您可以直接输入网易云音乐的歌曲 ID 或链接来添加音乐。系统会自动获取封面、歌词和音频地址。
              </p>
              <button className="mt-6 text-brand-primary font-bold text-sm flex items-center gap-1 hover:underline relative z-10">
                了解更多 <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Music;
