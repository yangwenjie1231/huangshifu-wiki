import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Disc, X, Music as MusicIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMusic } from '../context/MusicContext';
import { clsx } from 'clsx';

export const GlobalMusicPlayer = () => {
  const { currentSong, setCurrentSong, isPlaying, setIsPlaying } = useMusic();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error("Playback failed:", e);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  if (!currentSong) return null;

  return (
    <motion.div 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className={clsx(
        "fixed bottom-0 left-0 right-0 z-[60] bg-white/90 backdrop-blur-xl border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] transition-all duration-500",
        isExpanded ? "h-auto" : "h-20"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 h-full flex flex-col">
        {/* Progress Bar (Mini) */}
        {!isExpanded && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
            <motion.div 
              className="h-full bg-brand-primary"
              initial={{ width: 0 }}
              animate={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="relative group cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
              <motion.div 
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 rounded-full border-2 border-gray-900 overflow-hidden shadow-lg"
              >
                <img src={currentSong.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </motion.div>
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-full transition-opacity">
                {isExpanded ? <ChevronDown size={16} className="text-white" /> : <ChevronUp size={16} className="text-white" />}
              </div>
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-gray-900 truncate">{currentSong.title}</h4>
              <p className="text-xs text-gray-400 truncate">{currentSong.artist}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4">
              <button className="text-gray-400 hover:text-gray-900 transition-colors">
                <SkipBack size={20} />
              </button>
              <button 
                onClick={togglePlay}
                className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-md"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
              <button className="text-gray-400 hover:text-gray-900 transition-colors">
                <SkipForward size={20} />
              </button>
            </div>
            
            {/* Mobile Play Button */}
            <button 
              onClick={togglePlay}
              className="md:hidden w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>

            <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-gray-400 w-24 justify-end">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>

            <button 
              onClick={() => setCurrentSong(null)}
              className="p-2 text-gray-300 hover:text-red-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="pb-8 pt-4 border-t border-gray-50"
            >
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="w-48 h-48 rounded-3xl overflow-hidden shadow-2xl flex-shrink-0">
                  <img src={currentSong.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-grow w-full">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h3 className="text-2xl font-serif font-bold text-gray-900">{currentSong.title}</h3>
                      <p className="text-brand-primary font-bold">{currentSong.artist} — {currentSong.album}</p>
                    </div>
                    <div className="text-sm font-bold text-gray-400">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                  </div>
                  
                  <input 
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleProgressChange}
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-brand-primary mb-6"
                  />

                  <div className="flex items-center justify-center md:justify-start gap-8">
                    <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                      <SkipBack size={28} />
                    </button>
                    <button 
                      onClick={togglePlay}
                      className="w-16 h-16 bg-gray-900 text-white rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-xl"
                    >
                      {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                      <SkipForward size={28} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <audio 
        ref={audioRef}
        src={currentSong.audioUrl}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
    </motion.div>
  );
};
