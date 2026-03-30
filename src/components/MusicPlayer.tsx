import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music as MusicIcon, Disc } from 'lucide-react';
import { motion } from 'motion/react';
import { useMusic } from '../context/MusicContext';
import { clsx } from 'clsx';

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  lyric?: string;
}

export const MusicPlayer = ({ songId }: { songId: string }) => {
  const { 
    currentSong, setCurrentSong, isPlaying, setIsPlaying, playNext, playPrevious,
    currentTime, duration, volume, isMuted, seekTo, setVolume, toggleMute
  } = useMusic();
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSong = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/music/song/${songId}`);
        const data = await response.json();
        setSong(data);
      } catch (e) {
        console.error("Error fetching song:", e);
      }
      setLoading(false);
    };

    if (songId) fetchSong();
  }, [songId]);

  const togglePlay = () => {
    if (currentSong?.id !== song?.id) {
      setCurrentSong(song);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handlePlayPrevious = () => {
    playPrevious();
  };

  const handlePlayNext = () => {
    playNext();
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    seekTo(time);
  };

  if (loading) return <div className="p-8 text-center animate-pulse">加载音乐中...</div>;
  if (!song) return null;

  const isCurrent = currentSong?.id === song.id;

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[40px] p-8 border border-gray-100 shadow-xl max-w-2xl mx-auto overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent pointer-events-none" />
      
      <div className="flex flex-col md:flex-row gap-8 items-center relative z-10">
        <div className="relative">
          <motion.div 
            animate={{ rotate: (isCurrent && isPlaying) ? 360 : 0 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className={clsx(
              "w-48 h-48 rounded-full border-8 border-gray-900 shadow-2xl overflow-hidden relative",
              !(isCurrent && isPlaying) && "animate-none"
            )}
          >
            <img 
              src={song.cover} 
              alt={song.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gray-900 rounded-full border-4 border-gray-800 flex items-center justify-center">
              <div className="w-2 h-2 bg-gray-700 rounded-full" />
            </div>
          </motion.div>
          
          <div className="absolute -bottom-2 -right-2 p-3 bg-brand-primary text-gray-900 rounded-2xl shadow-lg">
            <Disc size={20} className={(isCurrent && isPlaying) ? "animate-spin" : ""} />
          </div>
        </div>

        <div className="flex-grow text-center md:text-left w-full">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-3xl font-serif font-bold text-gray-900 mb-1">{song.title}</h3>
              <p className="text-brand-primary font-bold">{song.artist} — {song.album}</p>
            </div>
            <div className="text-sm font-bold text-gray-400 flex-shrink-0 ml-4">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          <input 
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleProgressChange}
            disabled={!duration}
            className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#FFD700] mb-6"
          />
          
          <div className="flex items-center justify-center md:justify-start gap-4 mb-6">
            <button onClick={handlePlayPrevious} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
              <SkipBack size={24} />
            </button>
            <button 
              onClick={togglePlay}
              className="w-16 h-16 bg-gray-900 text-white rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-xl"
            >
              {(isCurrent && isPlaying) ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
            </button>
            <button onClick={handlePlayNext} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
              <SkipForward size={24} />
            </button>
            
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={toggleMute}
                className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <Volume2 size={20} />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#FFD700]"
              />
              <span className="text-xs text-gray-400 w-8 text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
