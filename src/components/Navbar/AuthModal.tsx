import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { login, register, loginWithWeChat } from "../../lib/auth";
import { useToast } from "../Toast";
import { useI18n } from '../../lib/i18n';

export type AuthMode = "login" | "register" | "wechat";

interface AuthModalProps {
	open: boolean;
	onClose: () => void;
	onAuthSuccess: () => void;
	initialMode?: AuthMode;
}

export const AuthModal = ({ open, onClose, onAuthSuccess, initialMode = "login" }: AuthModalProps) => {
	const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [wechatCode, setWechatCode] = useState("");
	const [wechatPhotoURL, setWechatPhotoURL] = useState("");
	const [authLoading, setAuthLoading] = useState(false);
	const { show } = useToast();
	const { t } = useI18n();

	const modalRef = useRef<HTMLDivElement>(null)
	const previousFocusRef = useRef<HTMLElement | null>(null)

	useEffect(() => {
		if (open) {
			previousFocusRef.current = document.activeElement as HTMLElement
			requestAnimationFrame(() => {
				const firstInput = modalRef.current?.querySelector('input')
				if (firstInput) firstInput.focus()
			})
		} else {
			previousFocusRef.current?.focus()
		}
	}, [open])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key !== 'Tab' || !modalRef.current) return
		const focusable = modalRef.current.querySelectorAll<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')
		if (focusable.length === 0) return
		const first = focusable[0]
		const last = focusable[focusable.length - 1]
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault()
			last.focus()
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault()
			first.focus()
		}
	}

	const handleAuthSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (authMode === "wechat") {
			if (!wechatCode.trim()) return;
		} else if (!email || !password) {
			return;
		}

		try {
			setAuthLoading(true);
			if (authMode === "login") {
				await login(email, password);
			} else if (authMode === "register") {
				await register(
					email,
					password,
					displayName || email.split("@")[0] || t('auth.anonymousUser'),
				);
			} else {
				await loginWithWeChat(wechatCode, {
					displayName: displayName || undefined,
					photoURL: wechatPhotoURL || undefined,
				})
			}
			onClose();
			setEmail("");
			setPassword("");
			setDisplayName("");
			setWechatCode("");
			setWechatPhotoURL("");
			onAuthSuccess();
		} catch (error) {
			console.error("Auth failed:", error);
			show(error instanceof Error ? error.message : t('auth.loginFailed'), {
				variant: "error",
			});
		} finally {
			setAuthLoading(false);
		}
	};

	if (typeof document === "undefined") return null;

	return createPortal(
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40"
					role="dialog"
					aria-modal="true"
					aria-label={t('auth.dialogLabel')}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 8 }}
						className="w-full max-w-md bg-white rounded border border-[#e0dcd3] p-6"
						ref={modalRef}
						onKeyDown={handleKeyDown}
					>
						<div className="flex items-center justify-between mb-5">
							<h3 className="text-lg font-bold text-[#2c2c2c]">
								{authMode === "wechat"
									? t('auth.wechatLogin')
									: authMode === "login"
										? t('auth.accountLogin')
										: t('auth.accountRegister')}
							</h3>
							<button
								type="button"
								onClick={onClose}
								className="text-[#9e968e] hover:text-[#c8951e] transition-colors"
							>
								<X size={20} />
							</button>
						</div>

						<form onSubmit={handleAuthSubmit} className="space-y-3">
							{(authMode === "register" || authMode === "wechat") && (
								<div>
									<label htmlFor="auth-display-name" className="sr-only">{t('auth.labelDisplayName')}</label>
									<input
										id="auth-display-name"
										type="text"
										value={displayName}
										onChange={(e) => setDisplayName(e.target.value)}
										placeholder={
											authMode === "wechat"
												? t('auth.placeholderWechatDisplayName')
												: t('auth.placeholderDisplayName')
										}
										className="w-full px-4 py-2.5 text-sm bg-[#f7f5f0] rounded border border-[#e0dcd3] focus:border-[#c8951e] focus:outline-none text-[#2c2c2c]"
									/>
								</div>
							)}
							{authMode === "wechat" ? (
								<>
									<div>
										<label htmlFor="auth-wechat-code" className="sr-only">{t('auth.labelWechatCode')}</label>
										<input
											id="auth-wechat-code"
											type="text"
											required
											value={wechatCode}
											onChange={(e) => setWechatCode(e.target.value)}
											placeholder={t('auth.placeholderWechatCode')}
											className="w-full px-4 py-2.5 text-sm bg-[#f7f5f0] rounded border border-[#e0dcd3] focus:border-[#c8951e] focus:outline-none text-[#2c2c2c]"
										/>
									</div>
									<div>
										<label htmlFor="auth-wechat-photo" className="sr-only">{t('auth.labelPhotoURL')}</label>
										<input
											id="auth-wechat-photo"
											type="url"
											value={wechatPhotoURL}
											onChange={(e) => setWechatPhotoURL(e.target.value)}
											placeholder={t('auth.placeholderPhotoURL')}
											className="w-full px-4 py-2.5 text-sm bg-[#f7f5f0] rounded border border-[#e0dcd3] focus:border-[#c8951e] focus:outline-none text-[#2c2c2c]"
										/>
									</div>
									<p className="text-xs text-[#9e968e] leading-relaxed">
										{t('auth.mockCodeHint')}
									</p>
								</>
							) : (
								<>
									<div>
										<label htmlFor="auth-email" className="sr-only">{t('auth.labelEmail')}</label>
										<input
											id="auth-email"
											type="email"
											required
											autoComplete="email"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											placeholder={t('auth.placeholderEmail')}
											className="w-full px-4 py-2.5 text-sm bg-[#f7f5f0] rounded border border-[#e0dcd3] focus:border-[#c8951e] focus:outline-none text-[#2c2c2c]"
										/>
									</div>
									<div>
										<label htmlFor="auth-password" className="sr-only">{t('auth.labelPassword')}</label>
										<input
											id="auth-password"
											type="password"
											required
											minLength={6}
											autoComplete="current-password"
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											placeholder={t('auth.placeholderPassword')}
											className="w-full px-4 py-2.5 text-sm bg-[#f7f5f0] rounded border border-[#e0dcd3] focus:border-[#c8951e] focus:outline-none text-[#2c2c2c]"
										/>
									</div>
								</>
							)}

							<button
								type="submit"
								disabled={authLoading}
								className="w-full px-4 py-2.5 bg-[#c8951e] text-white rounded font-medium hover:bg-[#dca828] active:scale-[0.98] transition-all disabled:opacity-50 text-sm"
							>
								{authLoading
									? authMode === "login"
										? t('auth.loggingIn')
										: authMode === "register"
											? t('auth.registering')
											: t('auth.loggingIn')
									: authMode === "login"
										? t('auth.login')
										: authMode === "register"
											? t('auth.register')
											: t('auth.wechatLogin')}
							</button>
						</form>

						<div className="mt-4 flex items-center justify-between gap-2 text-sm pb-safe">
							<button
								type="button"
								onClick={() =>
									setAuthMode(authMode === "login" ? "register" : "login")
								}
								className="font-medium text-[#c8951e] hover:underline"
							>
								{authMode === "login"
									? t('auth.noAccountGoRegister')
									: t('auth.hasAccountGoLogin')}
							</button>
							<button
								type="button"
								onClick={() =>
									setAuthMode(authMode === "wechat" ? "login" : "wechat")
								}
								className="font-medium text-[#c8951e] hover:underline"
							>
								{authMode === "wechat" ? t('auth.switchToAccount') : t('auth.switchToWechat')}
							</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	);
};
