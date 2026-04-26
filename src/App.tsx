import React from "react";
import {
	BrowserRouter as Router,
	Navigate,
	Route,
	Routes,
	useLocation,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { MusicProvider, useMusic } from "./context/MusicContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { Navbar } from "./components/Navbar";
import { BottomNav } from "./components/BottomNav";
import { AnnouncementBar } from "./components/AnnouncementBar";
import { GlobalMusicPlayer } from "./components/GlobalMusicPlayer";
import { clsx } from "clsx";
import { loginWithWeChat } from "./lib/auth";
import {
	clearMiniProgramLoginParams,
	getMiniProgramLoginPayload,
	isMiniProgramWebView,
} from "./lib/miniProgram";

import Home from "./pages/Home";
import Wiki from "./pages/Wiki";
import Profile from "./pages/Profile";
import Recruit from "./pages/Recruit";
import Forum from "./pages/Forum";
import Music from "./pages/Music";
import Gallery from "./pages/Gallery";
import GalleryDetail from "./pages/GalleryDetail";
import AlbumDetail from "./pages/AlbumDetail";
import MusicDetail from "./pages/MusicDetail";
import MusicLinks from "./pages/MusicLinks";
import Search from "./pages/Search";
import Admin from "./pages/Admin";

const MainLayout = () => {
	const { currentSong } = useMusic();
	const { isAcademy } = useTheme();
	const location = useLocation();

	if (isAcademy) {
		const path = location.pathname;
		const forumWritePath =
			path === "/forum/new" || /\/forum\/[^/]+\/edit$/.test(path);
		const wikiWritePath =
			path === "/wiki/new" ||
			/\/wiki\/[^/]+\/edit$/.test(path) ||
			/\/wiki\/[^/]+\/branches/.test(path) ||
			/\/wiki\/[^/]+\/prs/.test(path);
		const profilePath = path === "/profile" || path.startsWith("/profile/");
		const adminPath = path === "/admin" || path.startsWith("/admin/");

		if (forumWritePath) {
			return (
				<Navigate
					to={{
						pathname: "/forum",
						search: location.search,
						hash: location.hash,
					}}
					replace
				/>
			);
		}

		if (wikiWritePath || profilePath || adminPath) {
			return (
				<Navigate
					to={{
						pathname: "/wiki",
						search: location.search,
						hash: location.hash,
					}}
					replace
				/>
			);
		}
	}

	return (
		<div className="min-h-screen flex flex-col">
			<AnnouncementBar />
			<Navbar />
			<main
				className={clsx(
					"flex-grow",
					currentSong ? "pb-36 md:pb-20" : "pb-20 md:pb-0",
				)}
			>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/recruit" element={<Recruit />} />
					<Route path="/wiki/*" element={<Wiki />} />
					<Route path="/forum/*" element={<Forum />} />
					<Route path="/gallery" element={<Gallery />} />
					<Route path="/gallery/:galleryId" element={<GalleryDetail />} />
					<Route path="/music" element={<Music />} />
					<Route path="/music/:songId" element={<MusicDetail />} />
					<Route path="/music/links" element={<MusicLinks />} />
					<Route path="/album/:albumId" element={<AlbumDetail />} />
					<Route path="/search" element={<Search />} />
					<Route path="/profile" element={<Profile />} />
					<Route path="/admin" element={<Admin />} />
				</Routes>
			</main>
			<GlobalMusicPlayer />
			<BottomNav />
			<footer
				className="text-center"
				style={{
					background: '#f0ece3',
					padding: '40px 24px',
					color: '#9e968e',
					fontSize: '0.8125rem',
					letterSpacing: '0.08em',
					marginBottom: currentSong ? '80px' : '0',
				}}
			>
				<p>黄诗扶 Wiki</p>
			</footer>
		</div>
	);
};

export default function App() {
	React.useEffect(() => {
		if (
			typeof document !== "undefined" &&
			document.documentElement.dataset.theme === "academy"
		) {
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
			console.error("Mini program auto login error:", error);
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
