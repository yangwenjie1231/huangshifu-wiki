import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
	Music,
	Book,
	MessageSquare,
	LogIn,
	LogOut,
	Shield,
	Image as ImageIcon,
	Search,
	MessageCircle,
	Menu,
	X,
	Sun,
	Moon,
} from "lucide-react";
import { clsx } from "clsx";
import { logoutRequest } from "../lib/auth";
import { useToast } from "./Toast";
import { useTheme } from "../context/ThemeContext";
import { withThemeSearch } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { AuthModal } from "./Navbar/AuthModal";
import type { AuthMode } from "./Navbar/AuthModal";
import { NotificationPanel } from "./Navbar/NotificationPanel";
import { MobileMenu } from "./Navbar/MobileMenu";

export const Navbar = () => {
	const { user, profile, isAdmin, isBanned } = useAuth();
	const { isAcademy, theme, toggleTheme } = useTheme();
	const { t } = useI18n();
	const navigate = useNavigate();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [authModalOpen, setAuthModalOpen] = useState(false);
	const [authInitialMode, setAuthInitialMode] = useState<AuthMode>("login");
	const { show } = useToast();
	const themedTo = (path: string) =>
		withThemeSearch(path, isAcademy ? "academy" : "default");
	const themeLabel = theme === "academy" ? t('app.title') : t('app.title');

	const handleThemeToggle = () => {
		toggleTheme();
		setIsMenuOpen(false);
	};

	const openAuthModal = (mode: AuthMode) => {
		setAuthInitialMode(mode);
		setAuthModalOpen(true);
	};

	const handleLogout = async () => {
		try {
			await logoutRequest();
			setIsMenuOpen(false);
		} catch (error) {
			console.error("Logout failed:", error);
			show("退出登录失败，请稍后重试", { variant: "error" });
		}
	};

	const handleNotifNavigate = (link: string) => {
		navigate(link);
	};

	return (
		<nav
			className={clsx(
				"sticky top-0 z-50 bg-brand-paper/80 backdrop-blur-md border-b border-gray-200",
				isAcademy && "academy-nav-shell",
			)}
		>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between h-16 items-center">
					<div className="flex items-center gap-8">
						<Link to={themedTo("/")} className="flex items-center gap-2 group">
							<div
								className={clsx(
									"w-10 h-10 rounded-full bg-brand-olive flex items-center justify-center text-white font-serif italic text-xl",
									isAcademy && "academy-logo-medallion",
								)}
							>
								诗
							</div>
							<span
								className={clsx(
									"font-serif text-2xl font-semibold tracking-tight text-brand-olive",
									isAcademy && "academy-wordmark",
								)}
							>
								诗扶小筑
							</span>
						</Link>

						<div className="hidden md:flex items-center gap-6">
							<NavLink
								to={themedTo("/wiki")}
								className={({ isActive }) =>
									clsx(
										"flex items-center gap-1.5 text-sm font-medium transition-colors",
										isActive
											? "text-brand-olive"
											: "text-gray-500 hover:text-brand-olive",
									)
								}
							>
								<Book size={18} />
								{t('nav.wiki')}
							</NavLink>
							<NavLink
								to={themedTo("/forum")}
								className={({ isActive }) =>
									clsx(
										"flex items-center gap-1.5 text-sm font-medium transition-colors",
										isActive
											? "text-brand-olive"
											: "text-gray-500 hover:text-brand-olive",
									)
								}
							>
								<MessageSquare size={18} />
								{t('nav.forum')}
							</NavLink>
							<NavLink
								to={themedTo("/gallery")}
								className={({ isActive }) =>
									clsx(
										"flex items-center gap-1.5 text-sm font-medium transition-colors",
										isActive
											? "text-brand-olive"
											: "text-gray-500 hover:text-brand-olive",
									)
								}
							>
								<ImageIcon size={18} />
								{t('nav.gallery')}
							</NavLink>
							<NavLink
								to={themedTo("/music")}
								className={({ isActive }) =>
									clsx(
										"flex items-center gap-1.5 text-sm font-medium transition-colors",
										isActive
											? "text-brand-olive"
											: "text-gray-500 hover:text-brand-olive",
									)
								}
							>
								<Music size={18} />
								{t('nav.music')}
							</NavLink>
							<NavLink
								to={themedTo("/search")}
								className={({ isActive }) =>
									clsx(
										"flex items-center gap-1.5 text-sm font-medium transition-colors",
										isActive
											? "text-brand-olive"
											: "text-gray-500 hover:text-brand-olive",
									)
								}
							>
								<Search size={18} />
								搜索
							</NavLink>
						</div>
					</div>

					<div className="flex items-center gap-4">
						<div className="hidden md:flex items-center gap-4">
							<button
								type="button"
								onClick={handleThemeToggle}
								className={clsx(
									"flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:text-brand-olive hover:border-brand-olive/40 transition-colors",
									isAcademy &&
										"academy-theme-toggle text-[color:var(--color-theme-accent-strong)]",
								)}
								title={`切换到${theme === "academy" ? "诗扶小筑" : "从前书院"}`}
							>
								{theme === "academy" ? <Sun size={16} /> : <Moon size={16} />}
								{themeLabel}
							</button>
							{user ? (
								<div className="flex items-center gap-4">
									{isBanned && (
										<span className="text-[10px] font-bold px-2 py-1 rounded bg-red-50 text-red-600">
											账号受限
										</span>
									)}
									{!isAcademy && isAdmin && (
										<Link
											to="/admin"
											className="text-gray-500 hover:text-brand-olive"
										>
											<Shield size={20} />
										</Link>
									)}
									{!isAcademy && user && (
										<NotificationPanel
											theme={theme}
											onNavigate={handleNotifNavigate}
										/>
									)}
									{!isAcademy && user && (
										<Link
											to="/profile"
											className="flex items-center gap-2 group"
										>
											<img
												src={profile?.photoURL || user.photoURL || ""}
												alt=""
												className="w-8 h-8 rounded-full border border-gray-200"
												referrerPolicy="no-referrer"
											/>
											<span className="hidden sm:inline text-sm font-medium text-gray-700 group-hover:text-brand-olive">
												{profile?.displayName || user.displayName}
											</span>
										</Link>
									)}
									{!isAcademy && user && (
										<button
											type="button"
											onClick={handleLogout}
											className="text-gray-400 hover:text-red-500 transition-colors"
										>
											<LogOut size={20} />
										</button>
									)}
								</div>
							) : (
								!isAcademy && (
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() => openAuthModal("register")}
											className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-all shadow-sm"
										>
											<MessageCircle size={18} />
											账号注册
										</button>
										<button
											type="button"
											onClick={() => openAuthModal("login")}
											className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-olive text-white text-sm font-medium hover:bg-brand-olive/90 transition-all shadow-sm"
										>
											<LogIn size={18} />
											账号登录
										</button>
									</div>
								)
							)}
						</div>

						{/* Mobile Menu Toggle */}
						<button
							type="button"
							onClick={() => setIsMenuOpen(!isMenuOpen)}
							className="md:hidden p-2 text-gray-500 hover:text-brand-olive transition-colors"
						>
							{isMenuOpen ? <X size={24} /> : <Menu size={24} />}
						</button>
					</div>
				</div>
			</div>

			{/* Mobile Menu */}
			<MobileMenu
				open={isMenuOpen}
				onClose={() => setIsMenuOpen(false)}
				theme={theme}
				themeLabel={themeLabel}
				isAcademy={isAcademy}
				onThemeToggle={handleThemeToggle}
				onOpenAuth={openAuthModal}
				onLogout={handleLogout}
			/>

			{/* Auth Modal */}
			{!isAcademy && (
				<AuthModal
					key={authInitialMode}
					open={authModalOpen}
					onClose={() => setAuthModalOpen(false)}
					onAuthSuccess={() => setIsMenuOpen(false)}
					initialMode={authInitialMode}
				/>
			)}
		</nav>
	);
};
