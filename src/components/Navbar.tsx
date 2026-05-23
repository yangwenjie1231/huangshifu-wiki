import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Server, UserRound, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { logoutRequest } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { DEFAULT_AVATAR, handleAvatarError } from '../lib/defaultAvatar'
import { useToast } from './Toast'
import { AuthModal } from './Navbar/AuthModal'
import type { AuthMode } from './Navbar/AuthModal'
import { MobileMenu } from './Navbar/MobileMenu'
import { NotificationPanel } from './Navbar/NotificationPanel'
import { ThemeToggle } from './ThemeToggle'
import styles from './Navbar.module.css'

export const Navbar = () => {
	const { user, profile, isAdmin, isBanned, loading } = useAuth()
	const { t } = useI18n()
	const navigate = useNavigate()
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
	const [authModalOpen, setAuthModalOpen] = useState(false)
	const [authInitialMode, setAuthInitialMode] = useState<AuthMode>('login')
	const accountMenuRef = useRef<HTMLDivElement | null>(null)
	const { show } = useToast()
	const isAuthenticated = Boolean(user)
	const isAuthResolved = !loading
	const displayName = profile?.displayName || user?.displayName || '游客'
	const accountAvatarSrc = profile?.photoURL || user?.photoURL || DEFAULT_AVATAR

	const openAuthModal = (mode: AuthMode) => {
		setAuthInitialMode(mode)
		setAuthModalOpen(true)
	}

	const closeAccountMenu = () => {
		setIsAccountMenuOpen(false)
	}

	const handleAccountMenuBlur = (event: React.FocusEvent<HTMLDivElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
			return
		}

		closeAccountMenu()
	}

	useEffect(() => {
		if (!isAccountMenuOpen) {
			return
		}

		const handlePointerDown = (event: PointerEvent) => {
			if (!accountMenuRef.current?.contains(event.target as Node)) {
				closeAccountMenu()
			}
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				closeAccountMenu()
			}
		}

		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)

		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [isAccountMenuOpen])

	const handleLogout = async () => {
		try {
			await logoutRequest()
			setIsMenuOpen(false)
			closeAccountMenu()
		} catch (error) {
			console.error('Logout failed:', error)
			show('退出登录失败，请稍后重试', { variant: 'error' })
		}
	}

	const handleNotifNavigate = (link: string) => {
		closeAccountMenu()
		navigate(link)
	}

	const handleAccountMenuMouseDownCapture = (event: React.MouseEvent<HTMLDivElement>) => {
		const target = event.target as HTMLElement
		const interactiveElement = target.closest(
			'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
		)

		if (!interactiveElement) {
			event.preventDefault()
		}
	}

	return (
		<nav
			className="sticky top-0 z-[100] border-b border-border bg-bg-primary/92 backdrop-blur-md"
			role="navigation"
			aria-label="主导航"
		>
			<div
				className="max-w-[1100px] mx-auto px-6"
				style={{
					height: '60px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<div className="flex items-center gap-7">
					<Link
						to="/"
						className="flex items-center gap-2 group"
						style={{ textDecoration: 'none', color: 'inherit' }}
					>
						<div className="w-7 h-7 flex items-center justify-center text-white text-sm bg-brand-gold rounded">
							诗
						</div>
						<span
							className="font-semibold text-text-primary"
							style={{ fontSize: '1.25rem', letterSpacing: '0.15em' }}
						>
							诗扶小筑
						</span>
					</Link>

					<div className="hidden md:flex items-center" style={{ gap: '28px' }}>
						<NavLink to="/wiki" className={styles.navLink}>
							{t('nav.wiki')}
						</NavLink>
						<NavLink to="/forum" className={styles.navLink}>
							{t('nav.forum')}
						</NavLink>
						<NavLink to="/gallery" className={styles.navLink}>
							{t('nav.gallery')}
						</NavLink>
						<NavLink to="/music" className={styles.navLink}>
							{t('nav.music')}
						</NavLink>
						<NavLink to="/search" className={styles.navLink}>
							搜索
						</NavLink>
					</div>
				</div>

				<div className="flex items-center" style={{ gap: '16px' }}>
					<div className="hidden md:flex items-center" style={{ gap: '16px' }}>
						{isAuthenticated ? <NotificationPanel onNavigate={handleNotifNavigate} /> : null}

						<div
							ref={accountMenuRef}
							className={styles.accountMenu}
							data-open={isAccountMenuOpen ? 'true' : 'false'}
							onBlur={handleAccountMenuBlur}
						>
							<button
								type="button"
								onClick={() => {
									if (!isAuthResolved) {
										return
									}

									setIsAccountMenuOpen((open) => !open)
								}}
								className={`${styles.avatarTrigger} ${
									loading
										? styles.avatarTriggerPending
										: !isAuthenticated
											? styles.avatarTriggerGuest
											: ''
								}`}
								aria-haspopup="menu"
								aria-expanded={isAccountMenuOpen}
								aria-label={
									loading
										? '正在确认登录状态'
										: isAuthenticated
											? `${displayName}的账户菜单`
											: '打开账户菜单'
								}
								disabled={loading}
							>
								{loading ? null : isAuthenticated ? (
									<img
										src={accountAvatarSrc}
										alt=""
										className={styles.avatarImage}
										referrerPolicy="no-referrer"
										onError={handleAvatarError}
									/>
								) : (
									<span className={styles.guestAvatarPlaceholder} aria-hidden="true">
										<UserRound size={14} strokeWidth={1.75} />
									</span>
								)}
							</button>

							<div
								className={styles.accountMenuPanel}
								aria-label="账户菜单"
								onMouseDownCapture={handleAccountMenuMouseDownCapture}
							>
								<div className={styles.menuStack}>
									{isAuthenticated ? (
										<>
											<Link
												to="/profile"
												className={styles.profileSummary}
												onClick={closeAccountMenu}
											>
												<img
													src={accountAvatarSrc}
													alt=""
													className={styles.profileSummaryAvatar}
													referrerPolicy="no-referrer"
													onError={handleAvatarError}
												/>
												<div className={styles.profileSummaryText}>
													<span className={styles.profileName}>{displayName}</span>
													<span className={styles.profileMeta}>
														{isAdmin ? '管理员账户' : '查看个人资料'}
													</span>
												</div>
											</Link>

											{isBanned && (
												<div className={styles.statusNotice}>
													账号受限
													{profile?.banReason ? `：${profile.banReason}` : ''}
												</div>
											)}

											{isAdmin && (
												<Link
													to="/admin"
													className={styles.menuAction}
													onClick={closeAccountMenu}
												>
													<Server size={16} />
													<span>管理后台</span>
												</Link>
											)}
										</>
									) : (
										<div className={styles.menuBlock}>
											<div className={styles.menuLabel}>账号</div>
											<div className={styles.authActions}>
												<button
													type="button"
													onClick={() => {
														closeAccountMenu()
														openAuthModal('login')
													}}
													className={styles.menuPrimaryAction}
												>
													登录
												</button>
												<button
													type="button"
													onClick={() => {
														closeAccountMenu()
														openAuthModal('register')
													}}
													className={styles.menuSecondaryAction}
												>
													注册
												</button>
											</div>
										</div>
									)}

									<div className={styles.menuBlock}>
										<div className={styles.menuLabel}>主题外观</div>
										<ThemeToggle fullWidth compact />
									</div>

									{isAuthenticated ? (
										<button
											type="button"
											onClick={handleLogout}
											className={styles.menuDangerAction}
										>
											<LogOut size={16} />
											<span>退出登录</span>
										</button>
									) : null}
								</div>
							</div>
						</div>
					</div>

					<button
						type="button"
						onClick={() => setIsMenuOpen(!isMenuOpen)}
						className="md:hidden p-2 text-text-muted hover:text-brand-gold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
						aria-label={isMenuOpen ? '关闭菜单' : '打开菜单'}
					>
						{isMenuOpen ? <X size={24} /> : <Menu size={24} />}
					</button>
				</div>
			</div>

			<MobileMenu
				open={isMenuOpen}
				onClose={() => setIsMenuOpen(false)}
				onOpenAuth={openAuthModal}
				onLogout={handleLogout}
			/>

			{(
				<AuthModal
					open={authModalOpen}
					onClose={() => setAuthModalOpen(false)}
					onAuthSuccess={() => setIsMenuOpen(false)}
					initialMode={authInitialMode as AuthMode | undefined}
				/>
			)}
		</nav>
	)
}
