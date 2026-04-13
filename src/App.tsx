import React, { Suspense, lazy } from "react";
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

// High-traffic entry pages: static import so chunk is preloadable at first request.
// Low-traffic / deep pages: lazy import to keep first-load JS small.
import Home from "./pages/Home";
import Wiki from "./pages/Wiki";
import Forum from "./pages/Forum";
import Music from "./pages/Music";
import Gallery from "./pages/Gallery";
import Profile from "./pages/Profile";
import Recruit from "./pages/Recruit";

const GalleryDetail = lazy(() => import("./pages/GalleryDetail"));
const AlbumDetail = lazy(() => import("./pages/AlbumDetail"));
const MusicDetail = lazy(() => import("./pages/MusicDetail"));
const MusicLinks = lazy(() => import("./pages/MusicLinks"));
const Search = lazy(() => import("./pages/Search"));
const Admin = lazy(() => import("./pages/Admin"));

const PageLoader = () => (
	<div className="flex items-center justify-center min-h-[60vh]">
		<div className="w-8 h-8 border-2 border-brand-olive border-t-transparent rounded-full animate-spin" />
	</div>
);

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
					<Route
						path="/gallery/:galleryId"
						element={
							<Suspense fallback={<PageLoader />}>
								<GalleryDetail />
							</Suspense>
						}
					/>
					<Route path="/music" element={<Music />} />
					<Route
						path="/music/:songId"
						element={
							<Suspense fallback={<PageLoader />}>
								<MusicDetail />
							</Suspense>
						}
					/>
					<Route
						path="/music/links"
						element={
							<Suspense fallback={<PageLoader />}>
								<MusicLinks />
							</Suspense>
						}
					/>
					<Route
						path="/album/:albumId"
						element={
							<Suspense fallback={<PageLoader />}>
								<AlbumDetail />
							</Suspense>
						}
					/>
					<Route
						path="/search"
						element={
							<Suspense fallback={<PageLoader />}>
								<Search />
							</Suspense>
						}
					/>
					<Route path="/profile" element={<Profile />} />
					<Route
						path="/admin"
						element={
							<Suspense fallback={<PageLoader />}>
								<Admin />
							</Suspense>
						}
					/>
				</Routes>
			</main>
			<GlobalMusicPlayer />
			<BottomNav />
			<footer
				className={clsx(
					"bg-brand-paper border-t border-gray-100 py-12 mt-20",
					currentSong ? "mb-36 md:mb-20" : "mb-20 md:mb-0",
				)}
			>
				<div className="max-w-7xl mx-auto px-4 text-center">
					<p className="font-serif italic text-brand-olive text-lg mb-2">
						"诗情画意，扶摇直上"
					</p>
					<p className="text-gray-400 text-sm">
						© 2026 诗扶小筑 - 黄诗扶粉丝Wiki与社区 by ywj x miaopan
					</p>
					<a
						target="_blank"
						rel="nofollow noopener noreferrer"
						href="https://img.lhl.one"
						className="text-gray-400 text-sm hover:text-gray-600 mt-2 inline-block mr-4"
					>
						Image Hub
					</a>
					<a
						target="_blank"
						rel="nofollow noopener noreferrer"
						href="http://www.freecdn.vip/?zzwz"
						className="text-gray-400 text-sm hover:text-gray-600 mt-2 inline-block"
					>
						LHL's Images
					</a>
				</div>
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
