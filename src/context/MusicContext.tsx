import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

interface Song {
  id: string;
  docId?: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  playUrl?: string;
  lyric?: string | null;
}

interface MusicContextType {
  currentSong: Song | null;
  setCurrentSong: (song: Song | null) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playlist: Song[];
  currentIndex: number;
  setPlaylist: (songs: Song[]) => void;
  playAlbumTracks: (albumId: string, albumTitle: string, songs: Song[], startIndex?: number) => void;
  playSongAtIndex: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  currentTime: number;
  duration: number;
  setDuration: (duration: number) => void;
  volume: number;
  isMuted: boolean;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider = ({ children }: { children: ReactNode }) => {
  const [currentSong, setCurrentSongState] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlist, setPlaylistState] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const setPlaylist = useCallback((songs: Song[]) => {
    setPlaylistState(songs);

    if (!songs.length) {
      setCurrentIndex(-1);
      return;
    }

    setCurrentIndex((prevIndex) => {
      if (
        prevIndex >= 0 &&
        prevIndex < songs.length &&
        currentSong &&
        songs[prevIndex] &&
        ((songs[prevIndex].docId && currentSong.docId && songs[prevIndex].docId === currentSong.docId) ||
          songs[prevIndex].id === currentSong.id)
      ) {
        return prevIndex;
      }

      if (!currentSong) {
        return -1;
      }

      const matched = songs.findIndex(
        (song) => (song.docId && currentSong.docId ? song.docId === currentSong.docId : song.id === currentSong.id),
      );
      return matched;
    });
  }, [currentSong]);

  const setCurrentSong = useCallback((song: Song | null) => {
    if (!song) {
      setCurrentSongState(null);
      setCurrentIndex(-1);
      setIsPlaying(false);
      return;
    }

    setCurrentSongState(song);

    const index = playlist.findIndex(
      (item) => (item.docId && song.docId ? item.docId === song.docId : item.id === song.id),
    );
    setCurrentIndex(index);
  }, [playlist]);

  const playSongAtIndex = useCallback((index: number) => {
    if (!playlist.length) return;

    const normalizedIndex = ((index % playlist.length) + playlist.length) % playlist.length;
    const song = playlist[normalizedIndex];
    if (!song) return;

    setCurrentIndex(normalizedIndex);
    setCurrentSongState(song);
    setIsPlaying(true);
  }, [playlist]);

  const playAlbumTracks = useCallback((_albumId: string, _albumTitle: string, songs: Song[], startIndex = 0) => {
    if (!songs.length) {
      return;
    }

    setPlaylistState(songs);
    const normalizedIndex = ((startIndex % songs.length) + songs.length) % songs.length;
    const song = songs[normalizedIndex];
    if (!song) {
      return;
    }

    setCurrentIndex(normalizedIndex);
    setCurrentSongState(song);
    setIsPlaying(true);
  }, []);

  const playNext = useCallback(() => {
    if (!playlist.length) return;
    if (currentIndex < 0) {
      playSongAtIndex(0);
      return;
    }
    playSongAtIndex(currentIndex + 1);
  }, [currentIndex, playSongAtIndex, playlist.length]);

  const playPrevious = useCallback(() => {
    if (!playlist.length) return;
    if (currentIndex < 0) {
      playSongAtIndex(playlist.length - 1);
      return;
    }
    playSongAtIndex(currentIndex - 1);
  }, [currentIndex, playSongAtIndex, playlist.length]);

  const seekTo = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (isMuted && v > 0) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      currentSong,
      setCurrentSong,
      isPlaying,
      setIsPlaying,
      playlist,
      currentIndex,
      setPlaylist,
      playAlbumTracks,
      playSongAtIndex,
      playNext,
      playPrevious,
      currentTime,
      duration,
      setDuration,
      volume,
      isMuted,
      seekTo,
      setVolume,
      toggleMute,
    }),
    [
      currentSong,
      setCurrentSong,
      isPlaying,
      playlist,
      currentIndex,
      setPlaylist,
      playAlbumTracks,
      playSongAtIndex,
      playNext,
      playPrevious,
      currentTime,
      duration,
      volume,
      isMuted,
      seekTo,
      setVolume,
      toggleMute,
    ],
  );

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};
