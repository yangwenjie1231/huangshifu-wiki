import { Link, NavLink } from "react-router-dom";
import {
	Music,
	Book,
	MessageSquare,
	Image as ImageIcon,
	LogIn,
	LogOut,
	Shield,
	MessageCircle,
	Sun,
	Moon,
} from "lucide-react";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../lib/i18n";
import type { ThemeName } from "../../lib/theme";
import type { AuthMode } from "./AuthModal";

interface MobileMenuProps {
	open: boolean;
	onClose: () => void;
	theme: ThemeName;
	themeLabel: string;
	isAcademy: boolean;
	onThemeToggle: () => void;
	onOpenAuth: (mode: AuthMode) => void;
	onLogout: () => void;
}

export const MobileMenu = ({
	open,
	onClose,
	theme,
	themeLabel,
	isAcademy,
	onThemeToggle,
	onOpenAuth,
	onLogout,
}: MobileMenuProps) => {
	const { user, profile, isAdmin, isBanned } = useAuth();
	const { t } = useI18n();

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: "auto" }}
					exit={{ opacity: 0, height: 0 }}
					className="md:hidden bg-white border-b border-gray-100 overflow-hidden"
				>
					<div className="px-4 py-6 space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<NavLink
								to="/wiki"
								onClick={onClose}
								className="flex flex-col items-center gap-2 p-4 bg-brand-cream/30 rounded-2xl text-brand-olive"
							>
								<Book size={24} />
								<span className="text-xs font-bold">{t('nav.wiki')}</span>
							</NavLink>
							<NavLink
								to="/forum"
								onClick={onClose}
								className="flex flex-col items-center gap-2 p-4 bg-brand-cream/30 rounded-2xl text-brand-olive"
							>
								<MessageSquare size={24} />
								<span className="text-xs font-bold">{t('nav.forum')}</span>
							</NavLink>
							<NavLink
								to="/gallery"
								onClick={onClose}
								className="flex flex-col items-center gap-2 p-4 bg-brand-cream/30 rounded-2xl text-brand-olive"
							>
								<ImageIcon size={24} />
								<span className="text-xs font-bold">{t('nav.gallery')}</span>
							</NavLink>
							<NavLink
								to="/music"
								onClick={onClose}
								className="flex flex-col items-center gap-2 p-4 bg-brand-cream/30 rounded-2xl text-brand-olive"
							>
								<Music size={24} />
								<span className="text-xs font-bold">{t('nav.music')}</span>
							</NavLink>
						</div>

						<div className="pt-4 border-t border-gray-100">
							<button
								type="button"
								onClick={onThemeToggle}
								className={clsx(
									"w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600 hover:text-brand-olive hover:border-brand-olive/40 transition-colors",
									isAcademy &&
										"academy-theme-toggle text-[color:var(--color-theme-accent-strong)]",
								)}
							>
								{theme === "academy" ? <Sun size={18} /> : <Moon size={18} />}
								{themeLabel}
							</button>
							{!isAcademy && user ? (
								<div className="space-y-4">
									{isBanned && (
										<div className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs">
											账号已封禁
											{profile?.banReason ? `：${profile.banReason}` : ""}
										</div>
									)}
									<Link
										to="/profile"
										onClick={onClose}
										className="flex items-center gap-3 p-2"
									>
										<img
											src={profile?.photoURL || user.photoURL || ""}
											alt=""
											className="w-10 h-10 rounded-full border border-gray-200"
											referrerPolicy="no-referrer"
										/>
										<div>
											<p className="font-bold text-gray-900">
												{profile?.displayName || user.displayName}
											</p>
											<p className="text-xs text-gray-400">查看个人资料</p>
										</div>
									</Link>
									{isAdmin && (
										<Link
											to="/admin"
											onClick={onClose}
											className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-gray-600"
										>
											<Shield size={20} />
											<span className="text-sm font-medium">管理后台</span>
										</Link>
									)}
									<button
										type="button"
										onClick={() => {
											onLogout();
										}}
										className="w-full flex items-center gap-3 p-3 bg-red-50 text-red-500 rounded-xl"
									>
										<LogOut size={20} />
										<span className="text-sm font-medium">退出登录</span>
									</button>
								</div>
							) : !isAcademy ? (
								<div className="space-y-3">
									<button
										type="button"
										onClick={() => {
											onOpenAuth("register");
										}}
										className="w-full flex items-center justify-center gap-2 py-4 bg-green-500 text-white rounded-2xl font-bold"
									>
										<MessageCircle size={20} />
										账号注册
									</button>
									<button
										type="button"
										onClick={() => {
											onOpenAuth("login");
										}}
										className="w-full flex items-center justify-center gap-2 py-4 bg-brand-olive text-white rounded-2xl font-bold"
									>
										<LogIn size={20} />
										账号登录
									</button>
								</div>
							) : null}
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
