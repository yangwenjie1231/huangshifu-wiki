import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

interface Song {
  id: string;
  docId?: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  lyric?: string | null;
}

type RepeatMode = 'none' | 'one' | 'all';

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
  volume: number;
  setVolume: (value: number) => void;
  shuffle: boolean;
  setShuffle: (value: boolean) => void;
  repeatMode: RepeatMode;
  setRepeatMode: (value: RepeatMode) => void;
  history: Song[];
  markSongFinished: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider = ({ children }: { children: ReactNode }) => {
  const [currentSong, setCurrentSongState] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlist, setPlaylistState] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [volume, setVolume] = useState(0.9);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [history, setHistory] = useState<Song[]>([]);

  const addToHistory = useCallback((song: Song | null) => {
    if (!song) {
      return;
    }
    setHistory((prev) => {
      const key = song.docId || song.id;
      const merged = [song, ...prev.filter((item) => (item.docId || item.id) !== key)];
      return merged.slice(0, 50);
    });
  }, []);

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
    addToHistory(song);

    const index = playlist.findIndex(
      (item) => (item.docId && song.docId ? item.docId === song.docId : item.id === song.id),
    );
    setCurrentIndex(index);
  }, [addToHistory, playlist]);

  const playSongAtIndex = useCallback((index: number) => {
    if (!playlist.length) return;

    const normalizedIndex = ((index % playlist.length) + playlist.length) % playlist.length;
    const song = playlist[normalizedIndex];
    if (!song) return;

    setCurrentIndex(normalizedIndex);
    setCurrentSongState(song);
    addToHistory(song);
    setIsPlaying(true);
  }, [addToHistory, playlist]);

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
    addToHistory(song);
    setIsPlaying(true);
  }, [addToHistory]);

  const playNext = useCallback(() => {
    if (!playlist.length) return;

    if (shuffle && playlist.length > 1) {
      const candidates = playlist.map((_, index) => index).filter((index) => index !== currentIndex);
      if (candidates.length > 0) {
        const randomIndex = candidates[Math.floor(Math.random() * candidates.length)];
        playSongAtIndex(randomIndex);
        return;
      }
    }

    if (currentIndex < 0) {
      playSongAtIndex(0);
      return;
    }
    playSongAtIndex(currentIndex + 1);
  }, [currentIndex, playSongAtIndex, playlist, shuffle]);

  const playPrevious = useCallback(() => {
    if (!playlist.length) return;

    if (shuffle && playlist.length > 1) {
      const candidates = playlist.map((_, index) => index).filter((index) => index !== currentIndex);
      if (candidates.length > 0) {
        const randomIndex = candidates[Math.floor(Math.random() * candidates.length)];
        playSongAtIndex(randomIndex);
        return;
      }
    }

    if (currentIndex < 0) {
      playSongAtIndex(playlist.length - 1);
      return;
    }
    playSongAtIndex(currentIndex - 1);
  }, [currentIndex, playSongAtIndex, playlist, shuffle]);

  const markSongFinished = useCallback(() => {
    if (!playlist.length) {
      return;
    }

    if (repeatMode === 'one') {
      if (currentIndex >= 0) {
        playSongAtIndex(currentIndex);
      } else {
        playSongAtIndex(0);
      }
      return;
    }

    if (shuffle && playlist.length > 1) {
      const candidates = playlist.map((_, index) => index).filter((index) => index !== currentIndex);
      if (candidates.length > 0) {
        const randomIndex = candidates[Math.floor(Math.random() * candidates.length)];
        playSongAtIndex(randomIndex);
        return;
      }
    }

    if (currentIndex >= playlist.length - 1) {
      if (repeatMode === 'all') {
        playSongAtIndex(0);
      } else {
        setIsPlaying(false);
      }
      return;
    }

    playSongAtIndex(currentIndex + 1);
  }, [currentIndex, playSongAtIndex, playlist, repeatMode, shuffle]);

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
      volume,
      setVolume,
      shuffle,
      setShuffle,
      repeatMode,
      setRepeatMode,
      history,
      markSongFinished,
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
      volume,
      shuffle,
      repeatMode,
      history,
      markSongFinished,
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
