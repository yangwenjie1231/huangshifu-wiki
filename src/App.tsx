import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MusicProvider, useMusic } from './context/MusicContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { AnnouncementBar } from './components/AnnouncementBar';
import { GlobalMusicPlayer } from './components/GlobalMusicPlayer';
import { clsx } from 'clsx';
import Home from './pages/Home';
import Wiki from './pages/Wiki';
import Forum from './pages/Forum';
import Profile from './pages/Profile';
import Gallery from './pages/Gallery';
import GalleryDetail from './pages/GalleryDetail';
import Music from './pages/Music';
import AlbumDetail from './pages/AlbumDetail';
import Search from './pages/Search';
import Notifications from './pages/Notifications';
import Admin from './pages/Admin';

const MainLayout = () => {
  const { currentSong } = useMusic();

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className={clsx(
        "flex-grow",
        currentSong ? "pb-36 md:pb-20" : "pb-20 md:pb-0"
      )}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wiki/*" element={<Wiki />} />
          <Route path="/forum/*" element={<Forum />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/gallery/:galleryId" element={<GalleryDetail />} />
          <Route path="/music" element={<Music />} />
          <Route path="/album/:albumId" element={<AlbumDetail />} />
          <Route path="/search" element={<Search />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      <GlobalMusicPlayer />
      <BottomNav />
      <footer className={clsx(
        "bg-brand-paper border-t border-gray-100 py-12 mt-20",
        currentSong ? "mb-36 md:mb-20" : "mb-20 md:mb-0"
      )}>
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="font-serif italic text-brand-olive text-lg mb-2">“诗情画意，扶摇直上”</p>
          <p className="text-gray-400 text-sm">© 2026 诗扶小筑 - 黄诗扶粉丝Wiki与社区</p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MusicProvider>
        <Router>
          <MainLayout />
        </Router>
      </MusicProvider>
    </AuthProvider>
  );
}
