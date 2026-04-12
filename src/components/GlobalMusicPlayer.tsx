import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Disc, X, Music as MusicIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMusic } from '../context/MusicContext';
import { clsx } from 'clsx';
import { formatTime } from '../lib/formatUtils';

export const GlobalMusicPlayer = () => {
  const { 
    currentSong, setCurrentSong, isPlaying, setIsPlaying, playNext, playPrevious,
    currentTime: contextCurrentTime, duration: contextDuration, volume: contextVolume, isMuted: contextIsMuted,
    seekTo, setVolume: contextSetVolume, toggleMute: contextToggleMute, setDuration: contextSetDuration
  } = useMusic();
  const [isExpanded, setIsExpanded] = useState(false);
  const [resolvedPlayUrl, setResolvedPlayUrl] = useState('');
  const [resolvingPlayUrl, setResolvingPlayUrl] = useState(false);
  const [playUrlError, setPlayUrlError] = useState('');
  const [volumeSliderExpanded, setVolumeSliderExpanded] = useState(false);
  const volumeHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const resolvePlayUrl = async () => {
      if (!currentSong) {
        setResolvedPlayUrl('');
        setResolvingPlayUrl(false);
        setPlayUrlError('');
        return;
      }

      const fallback = currentSong.audioUrl || '';
      if (!currentSong.docId) {
        setResolvedPlayUrl(currentSong.playUrl || fallback);
        setResolvingPlayUrl(false);
        setPlayUrlError('');
        return;
      }

      const neteaseId = currentSong.platformIds?.neteaseId;
      if (currentSong.primaryPlatform === 'netease' && neteaseId) {
        const directUrl = `https://music.163.com/song/media/outer/url?id=${neteaseId}.mp3`;
        setResolvedPlayUrl(directUrl);
        setResolvingPlayUrl(false);
        setPlayUrlError('');
        return;
      }

      setResolvingPlayUrl(true);
      setPlayUrlError('');

      try {
        const response = await fetch(`/api/music/${encodeURIComponent(currentSong.docId)}/play-url`);
        if (!response.ok) {
          throw new Error(`play-url request failed: ${response.status}`);
        }
        const data = await response.json() as { playUrl?: string };
        const nextUrl = typeof data.playUrl === 'string' && data.playUrl.trim()
          ? data.playUrl.trim()
          : (currentSong.playUrl || fallback);
        setResolvedPlayUrl(nextUrl);
      } catch (error) {
        console.error('Resolve play url failed:', error);
        setResolvedPlayUrl(currentSong.playUrl || fallback);
        setPlayUrlError('播放地址获取失败，已使用备用链接');
      } finally {
        setResolvingPlayUrl(false);
      }
    };

    resolvePlayUrl();
  }, [currentSong]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    seekTo(0);
  }, [resolvedPlayUrl, seekTo]);

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

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = contextIsMuted ? 0 : contextVolume;
    }
  }, [contextVolume, contextIsMuted]);

  useEffect(() => {
    if (audioRef.current && audioRef.current.currentTime !== contextCurrentTime) {
      audioRef.current.currentTime = contextCurrentTime;
    }
  }, [contextCurrentTime]);

  const handleVolumeMouseEnter = () => {
    if (volumeHideTimeoutRef.current) {
      clearTimeout(volumeHideTimeoutRef.current);
      volumeHideTimeoutRef.current = null;
    }
    setVolumeSliderExpanded(true);
  };

  const handleVolumeMouseLeave = () => {
    volumeHideTimeoutRef.current = setTimeout(() => {
      setVolumeSliderExpanded(false);
    }, 1000);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  const handlePlayPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    playPrevious();
  };

  const handlePlayNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    playNext();
  };

  const onTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      seekTo(audioRef.current.currentTime);
    }
  }, [seekTo]);

  const onLoadedMetadata = useCallback(() => {
    if (audioRef.current && audioRef.current.duration) {
      contextSetDuration(audioRef.current.duration);
    }
  }, [contextSetDuration]);

  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      seekTo(time);
    }
  }, [seekTo]);

  if (!currentSong) return null;

  return (
    <motion.div 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className={clsx(
        "fixed left-0 right-0 z-[60] bg-white/90 backdrop-blur-xl border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] transition-all duration-500",
        isExpanded ? "bottom-0 h-auto" : "bottom-16 md:bottom-0 h-20"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 h-full flex flex-col">
        {/* Progress Bar (Mini) */}
        {!isExpanded && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
            <input
              type="range"
              min="0"
              max={contextDuration || 0}
              value={contextCurrentTime}
              onChange={handleProgressChange}
              disabled={!contextDuration || resolvingPlayUrl}
              className="absolute top-0 left-0 w-full h-1 appearance-none cursor-pointer accent-[#FFD700] bg-transparent"
            />
            <motion.div
              className="h-full bg-brand-primary pointer-events-none"
              initial={{ width: 0 }}
              animate={{ width: `${contextDuration > 0 ? (contextCurrentTime / contextDuration) * 100 : 0}%` }}
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
              <button onClick={handlePlayPrevious} className="text-gray-400 hover:text-gray-900 transition-colors">
                <SkipBack size={20} />
              </button>
              <button 
                onClick={togglePlay}
                className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-md"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
              <button onClick={handlePlayNext} className="text-gray-400 hover:text-gray-900 transition-colors">
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
              <span>{formatTime(contextCurrentTime)}</span>
              <span>/</span>
              <span>{formatTime(contextDuration)}</span>
            </div>

            <div className="relative" onMouseEnter={handleVolumeMouseEnter} onMouseLeave={handleVolumeMouseLeave}>
              <button
                onClick={contextToggleMute}
                className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <Volume2 size={20} />
              </button>
              <AnimatePresence>
                {volumeSliderExpanded && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-white rounded-xl shadow-lg border border-gray-100 flex items-center gap-2"
                  >
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={contextIsMuted ? 0 : contextVolume}
                      onChange={(e) => contextSetVolume(parseFloat(e.target.value))}
                      className="w-20 h-1 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#FFD700]"
                    />
                    <span className="text-xs text-gray-400 w-6 text-right">
                      {Math.round((contextIsMuted ? 0 : contextVolume) * 100)}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
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
                <div className="w-32 sm:w-40 md:w-48 h-32 sm:h-40 md:h-48 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex-shrink-0">
                  <img src={currentSong.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-grow w-full">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 sm:gap-4 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 truncate">{currentSong.title}</h3>
                      <p className="text-sm sm:text-base text-brand-primary font-bold truncate">{currentSong.artist} — {currentSong.album}</p>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-gray-400 whitespace-nowrap">
                      {formatTime(contextCurrentTime)} / {formatTime(contextDuration)}
                    </div>
                  </div>
                  
                  <input 
                    type="range"
                    min="0"
                    max={contextDuration || 0}
                    value={contextCurrentTime}
                    onChange={handleProgressChange}
                    disabled={!contextDuration || resolvingPlayUrl}
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#FFD700] mb-6"
                  />

                  {playUrlError ? (
                    <p className="text-xs text-amber-600 mt-2">{playUrlError}</p>
                  ) : null}

                  <div className="flex items-center justify-center sm:justify-start gap-6 sm:gap-8">
                    <button onClick={handlePlayPrevious} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                      <SkipBack size={24} className="sm:w-7 sm:h-7" />
                    </button>
                    <button 
                      onClick={togglePlay}
                      className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-900 text-white rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-xl"
                    >
                      {isPlaying ? <Pause size={28} className="sm:w-8 sm:h-8" /> : <Play size={28} className="sm:w-8 sm:h-8 ml-0.5" />}
                    </button>
                    <button onClick={handlePlayNext} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                      <SkipForward size={24} className="sm:w-7 sm:h-7" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 mt-4">
                    <button
                      onClick={contextToggleMute}
                      className="text-gray-400 hover:text-gray-900 transition-colors p-1 sm:p-0"
                    >
                      <Volume2 size={18} className="sm:w-5 sm:h-5" />
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={contextIsMuted ? 0 : contextVolume}
                      onChange={(e) => contextSetVolume(parseFloat(e.target.value))}
                      className="flex-grow h-1 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#FFD700]"
                    />
                    <span className="text-xs text-gray-400 w-8 hidden sm:inline">{Math.round((contextIsMuted ? 0 : contextVolume) * 100)}%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <audio
        ref={audioRef}
        src={resolvedPlayUrl || currentSong.playUrl || currentSong.audioUrl}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={playNext}
      />
    </motion.div>
  );
};
