import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MusicProvider, useMusic } from './context/MusicContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { AnnouncementBar } from './components/AnnouncementBar';
import { GlobalMusicPlayer } from './components/GlobalMusicPlayer';
import { clsx } from 'clsx';
import { loginWithWeChat } from './lib/auth';
import { clearMiniProgramLoginParams, getMiniProgramLoginPayload, isMiniProgramWebView } from './lib/miniProgram';

const Home = lazy(() => import('./pages/Home'));
const Wiki = lazy(() => import('./pages/Wiki'));
const Forum = lazy(() => import('./pages/Forum'));
const Profile = lazy(() => import('./pages/Profile'));
const Gallery = lazy(() => import('./pages/Gallery'));
const GalleryDetail = lazy(() => import('./pages/GalleryDetail'));
const Music = lazy(() => import('./pages/Music'));
const AlbumDetail = lazy(() => import('./pages/AlbumDetail'));
const MusicDetail = lazy(() => import('./pages/MusicDetail'));
const MusicLinks = lazy(() => import('./pages/MusicLinks'));
const Search = lazy(() => import('./pages/Search'));
const Admin = lazy(() => import('./pages/Admin'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-2 border-brand-olive border-t-transparent rounded-full animate-spin" />
  </div>
);

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
          <Route path="/" element={<Suspense fallback={<PageLoader />}><Home /></Suspense>} />
          <Route path="/wiki/*" element={<Suspense fallback={<PageLoader />}><Wiki /></Suspense>} />
          <Route path="/forum/*" element={<Suspense fallback={<PageLoader />}><Forum /></Suspense>} />
          <Route path="/gallery" element={<Suspense fallback={<PageLoader />}><Gallery /></Suspense>} />
          <Route path="/gallery/:galleryId" element={<Suspense fallback={<PageLoader />}><GalleryDetail /></Suspense>} />
          <Route path="/music" element={<Suspense fallback={<PageLoader />}><Music /></Suspense>} />
          <Route path="/music/:songId" element={<Suspense fallback={<PageLoader />}><MusicDetail /></Suspense>} />
          <Route path="/music/links" element={<Suspense fallback={<PageLoader />}><MusicLinks /></Suspense>} />
          <Route path="/album/:albumId" element={<Suspense fallback={<PageLoader />}><AlbumDetail /></Suspense>} />
          <Route path="/search" element={<Suspense fallback={<PageLoader />}><Search /></Suspense>} />
          <Route path="/profile" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
          <Route path="/admin" element={<Suspense fallback={<PageLoader />}><Admin /></Suspense>} />
        </Routes>
      </main>
      <GlobalMusicPlayer />
      <BottomNav />
      <footer className={clsx(
        "bg-brand-paper border-t border-gray-100 py-8 md:py-12 mt-12 md:mt-20",
        currentSong ? "mb-36 md:mb-20" : "mb-20 md:mb-0"
      )}>
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="font-serif italic text-brand-olive text-base md:text-lg mb-2">"诗情画意，扶摇直上"</p>
          <p className="text-gray-400 text-xs md:text-sm">© 2026 诗扶小筑 - 黄诗扶粉丝Wiki与社区</p>
          <a
            target="_blank"
            href="http://www.freecdn.vip/?zzwz"
            title="免费云加速（FreeCDN），为您免费提供网站加速和网站防御（DDOS、CC攻击）"
            className="text-gray-400 text-xs md:text-sm hover:text-gray-600 mt-2 inline-block"
          >
            本站由免费云加速（FreeCDN）提供网站加速和攻击防御服务
          </a>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  React.useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'academy') {
      return;
    }

    if (!isMiniProgramWebView()) {
      return;
    }

    const payload = getMiniProgramLoginPayload();
    if (!payload) {
      return;
    }

    clearMiniProgramLoginParams();
    loginWithWeChat(payload.code, {
      displayName: payload.displayName,
      photoURL: payload.photoURL,
    }).catch((error) => {
      console.error('Mini program auto login error:', error);
    });
  }, []);

  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <MusicProvider>
            <MainLayout />
          </MusicProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
