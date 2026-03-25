import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Disc, X, Shuffle, Repeat, Repeat1, History, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMusic } from '../context/MusicContext';
import { clsx } from 'clsx';

type LrcLine = {
  time: number;
  text: string;
};

const parseLrc = (raw?: string | null): LrcLine[] => {
  if (!raw) return [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  const output: LrcLine[] = [];
  const lines = raw.split(/\r?\n/);

  lines.forEach((line) => {
    const tags = [...line.matchAll(timeRegex)];
    if (!tags.length) return;
    const text = line.replace(timeRegex, '').trim();

    tags.forEach((match) => {
      const min = Number(match[1]);
      const sec = Number(match[2]);
      const ms = Number(match[3].padEnd(3, '0'));
      output.push({
        time: min * 60 + sec + ms / 1000,
        text,
      });
    });
  });

  return output.sort((a, b) => a.time - b.time);
};

export const GlobalMusicPlayer = () => {
  const {
    currentSong,
    setCurrentSong,
    isPlaying,
    setIsPlaying,
    playNext,
    playPrevious,
    volume,
    setVolume,
    shuffle,
    setShuffle,
    repeatMode,
    setRepeatMode,
    history,
    markSongFinished,
  } = useMusic();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const lyrics = useMemo(() => parseLrc(currentSong?.lyric), [currentSong?.lyric]);
  const currentLyricIndex = useMemo(() => {
    if (!lyrics.length) return -1;
    for (let i = lyrics.length - 1; i >= 0; i -= 1) {
      if (currentTime >= lyrics[i].time) {
        return i;
      }
    }
    return -1;
  }, [currentTime, lyrics]);

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

  const handlePlayPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    playPrevious();
  };

  const handlePlayNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    playNext();
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.volume = volume;
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(e.target.value);
    setVolume(Number.isFinite(next) ? next : 1);
  };

  const cycleRepeatMode = () => {
    if (repeatMode === 'none') {
      setRepeatMode('all');
      return;
    }
    if (repeatMode === 'all') {
      setRepeatMode('one');
      return;
    }
    setRepeatMode('none');
  };

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
                    <button onClick={handlePlayPrevious} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                      <SkipBack size={28} />
                    </button>
                    <button 
                      onClick={togglePlay}
                      className="w-16 h-16 bg-gray-900 text-white rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-xl"
                    >
                      {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                    </button>
                    <button onClick={handlePlayNext} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                      <SkipForward size={28} />
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Volume2 size={16} className="text-gray-500" />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volume}
                          onChange={handleVolumeChange}
                          className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-brand-primary"
                        />
                        <span className="text-xs text-gray-500 w-10 text-right">{Math.round(volume * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShuffle(!shuffle)}
                          className={clsx(
                            'px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                            shuffle ? 'bg-brand-olive text-white border-brand-olive' : 'bg-white text-gray-500 border-gray-200 hover:border-brand-olive/40',
                          )}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Shuffle size={14} /> 随机
                          </span>
                        </button>
                        <button
                          onClick={cycleRepeatMode}
                          className={clsx(
                            'px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                            repeatMode === 'none'
                              ? 'bg-white text-gray-500 border-gray-200 hover:border-brand-olive/40'
                              : 'bg-brand-olive text-white border-brand-olive',
                          )}
                        >
                          <span className="inline-flex items-center gap-1">
                            {repeatMode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
                            {repeatMode === 'none' ? '不循环' : repeatMode === 'all' ? '列表循环' : '单曲循环'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-brand-cream/30 rounded-2xl p-3 h-44 overflow-y-auto">
                      {lyrics.length ? (
                        <div className="space-y-1">
                          {lyrics.map((line, index) => (
                            <p
                              key={`${line.time}-${index}`}
                              className={clsx(
                                'text-xs leading-5 transition-colors',
                                index === currentLyricIndex ? 'text-brand-olive font-bold' : 'text-gray-500',
                              )}
                            >
                              {line.text || '...'}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-gray-400">暂无歌词</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <button
                      onClick={() => setShowHistory((prev) => !prev)}
                      className="text-xs font-bold text-gray-600 hover:text-brand-olive inline-flex items-center gap-1"
                    >
                      <History size={14} /> 播放历史 ({history.length})
                    </button>
                    {showHistory && (
                      <div className="mt-3 max-h-32 overflow-y-auto border border-gray-100 rounded-2xl">
                        {history.length ? history.map((song) => (
                          <button
                            key={song.docId || song.id}
                            onClick={() => setCurrentSong(song)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                          >
                            {song.title} - {song.artist}
                          </button>
                        )) : (
                          <p className="px-3 py-2 text-xs text-gray-400">暂无播放记录</p>
                        )}
                      </div>
                    )}
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
        onEnded={markSongFinished}
      />
    </motion.div>
  );
};
