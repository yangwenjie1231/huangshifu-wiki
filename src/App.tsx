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
import Profile from "./pages/Profile";
import Recruit from "./pages/Recruit";

// Route-level code splitting for non-critical pages
// These pages are lazy loaded to reduce initial bundle size
const Forum = lazy(() => import("./pages/Forum"));
const Music = lazy(() => import("./pages/Music"));
const Gallery = lazy(() => import("./pages/Gallery"));
const GalleryDetail = lazy(() => import("./pages/GalleryDetail"));
const AlbumDetail = lazy(() => import("./pages/AlbumDetail"));
const MusicDetail = lazy(() => import("./pages/MusicDetail"));
const MusicLinks = lazy(() => import("./pages/MusicLinks"));
const Search = lazy(() => import("./pages/Search"));
const Admin = lazy(() => import("./pages/Admin"));

// Enhanced skeleton screen for route loading fallback
const PageSkeleton = () => (
	<div className="min-h-[60vh] animate-pulse">
		{/* Header skeleton */}
		<div className="max-w-7xl mx-auto px-4 py-8">
			<div className="h-8 bg-gray-200 rounded-lg w-1/3 mb-4" />
			<div className="h-4 bg-gray-100 rounded w-1/2" />
		</div>
		{/* Content skeleton */}
		<div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
			<div className="h-32 bg-gray-100 rounded-2xl" />
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				<div className="h-48 bg-gray-100 rounded-2xl" />
				<div className="h-48 bg-gray-100 rounded-2xl" />
				<div className="h-48 bg-gray-100 rounded-2xl" />
			</div>
			<div className="h-64 bg-gray-100 rounded-2xl" />
		</div>
	</div>
);

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
					<Route
						path="/forum/*"
						element={
							<Suspense fallback={<PageSkeleton />}>
								<Forum />
							</Suspense>
						}
					/>
					<Route
						path="/gallery"
						element={
							<Suspense fallback={<PageSkeleton />}>
								<Gallery />
							</Suspense>
						}
					/>
					<Route
						path="/gallery/:galleryId"
						element={
							<Suspense fallback={<PageSkeleton />}>
								<GalleryDetail />
							</Suspense>
						}
					/>
					<Route
						path="/music"
						element={
							<Suspense fallback={<PageSkeleton />}>
								<Music />
							</Suspense>
						}
					/>
					<Route
						path="/music/:songId"
						element={
							<Suspense fallback={<PageSkeleton />}>
								<MusicDetail />
							</Suspense>
						}
					/>
					<Route
						path="/music/links"
						element={
							<Suspense fallback={<PageSkeleton />}>
								<MusicLinks />
							</Suspense>
						}
					/>
					<Route
						path="/album/:albumId"
						element={
							<Suspense fallback={<PageSkeleton />}>
								<AlbumDetail />
							</Suspense>
						}
					/>
					<Route
						path="/search"
						element={
							<Suspense fallback={<PageSkeleton />}>
								<Search />
							</Suspense>
						}
					/>
					<Route path="/profile" element={<Profile />} />
					<Route
						path="/admin"
						element={
							<Suspense fallback={<PageSkeleton />}>
								<Admin />
							</Suspense>
						}
					/>
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
