import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Heart, ExternalLink, MessageSquare, Link2, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useI18n } from '../../lib/i18n';
import { getPlatformExternalUrl } from '../../lib/musicPlatformUrls';
import { SmartImage } from '../SmartImage';
import type { SongItem } from '../../types/entities';
import type { ViewMode } from '../../types/userPreferences';

const getSongExternalUrl = (song: SongItem) => {
	const id = (song.id || '').trim();
	if (!id) return '#';
	return getPlatformExternalUrl(song.primaryPlatform || 'netease', id) || '#';
};

interface SongCardProps {
	song: SongItem;
	isBatchMode: boolean;
	isSelected: boolean;
	isCurrentSong: boolean;
	isFavoriting: boolean;
	isAdmin: boolean;
	isPostsSelected: boolean;
	viewMode?: ViewMode;
	onPlay: (song: SongItem) => void;
	onToggleSelect: (docId: string) => void;
	onToggleFavorite: (song: SongItem) => void;
	onCopyLink: (event: React.MouseEvent<HTMLButtonElement>, song: SongItem) => void;
	onDelete: (docId: string) => void;
	onShowPosts: (song: SongItem) => void;
}

const SongCard = React.memo(function SongCard({
	song,
	isBatchMode,
	isSelected,
	isCurrentSong,
	isFavoriting,
	isAdmin,
	isPostsSelected,
	viewMode = 'list',
	onPlay,
	onToggleSelect,
	onToggleFavorite,
	onCopyLink,
	onDelete,
	onShowPosts,
}: SongCardProps) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const isList = viewMode === 'list';
	const isSmallGrid = viewMode === 'small';

	const handleRowClick = () => {
		if (isBatchMode) {
			onToggleSelect(song.docId);
		} else {
			navigate(`/music/${song.docId}`);
		}
	};

	const renderBatchButton = (compact = false) => (
		<button
			onClick={(e) => { e.stopPropagation(); onToggleSelect(song.docId); }}
			className={clsx(
				"rounded text-xs font-semibold transition-all",
				compact ? "px-2 py-1.5" : "px-3 py-1.5",
				isSelected
					? "bg-[var(--color-theme-accent)] text-white"
					: "bg-surface-alt text-text-secondary hover:text-brand-gold"
			)}
		>
			{isSelected ? t('music.selected') : t('music.select')}
		</button>
	);

	const renderActionButtons = (compact = false) => (
		<>
			<button
				onClick={(e) => { e.stopPropagation(); onPlay(song); }}
				className={clsx(
					"rounded text-text-muted hover:text-brand-gold transition-colors",
					compact ? "p-1.5" : "p-2"
				)}
				title={t('music.play')}
				aria-label={`播放 ${song.title}`}
			>
				<Play size={compact ? 14 : 15} />
			</button>
			<button
				onClick={(e) => { e.stopPropagation(); onToggleFavorite(song); }}
				disabled={isFavoriting}
				className={clsx(
					"rounded transition-colors",
					compact ? "p-1.5" : "p-2",
					song.favoritedByMe ? "theme-text-error" : "text-text-muted theme-icon-button-danger"
				)}
				title={t('music.favorite')}
				aria-label={`${t('music.favorite')} ${song.title}`}
			>
				<Heart size={compact ? 14 : 15} />
			</button>
			<a
				href={getSongExternalUrl(song)}
				target="_blank"
				rel="noopener noreferrer"
				onClick={(e) => e.stopPropagation()}
				className={clsx(
					"text-text-muted hover:text-brand-gold transition-colors",
					compact ? "p-1.5" : "p-2"
				)}
				title={t('music.openOriginalLink')}
				aria-label={`${t('music.openOriginalLink')} ${song.title}`}
			>
				<ExternalLink size={compact ? 14 : 15} />
			</a>
			<button
				onClick={(event) => { event.stopPropagation(); onCopyLink(event, song); }}
				className={clsx(
					"text-text-muted hover:text-brand-gold transition-colors",
					compact ? "p-1.5" : "p-2"
				)}
				title={t('music.copyInternalLink')}
				aria-label={`${t('music.copyInternalLink')} ${song.title}`}
			>
				<Link2 size={compact ? 14 : 15} />
			</button>
			<button
				onClick={(e) => { e.stopPropagation(); onShowPosts(song); }}
				className={clsx(
					"transition-colors",
					compact ? "p-1.5" : "p-2",
					isPostsSelected ? "text-brand-gold" : "text-text-muted hover:text-brand-gold"
				)}
				title={t('music.viewPosts')}
				aria-label={`${t('music.viewPosts')} ${song.title}`}
			>
				<MessageSquare size={compact ? 14 : 15} />
			</button>
			{isAdmin && (
				<button
					onClick={(e) => { e.stopPropagation(); onDelete(song.docId); }}
					className={clsx(
						"text-text-muted theme-icon-button-danger transition-colors",
						compact ? "p-1.5" : "p-2"
					)}
					title={t('music.deleteSong')}
					aria-label={`删除 ${song.title}`}
				>
					<Trash2 size={compact ? 14 : 15} />
				</button>
			)}
		</>
	);

	if (!isList) {
		return (
			<div
				onClick={handleRowClick}
				onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); } }}
				className={clsx(
					"gufeng-song-item group cursor-pointer rounded transition-all",
					"focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-theme-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
					isCurrentSong && !isBatchMode && "bg-brand-gold/10",
					isBatchMode && isSelected && "bg-brand-gold/15"
				)}
				role="button"
				tabIndex={0}
				aria-label={`${song.title} - ${song.artist || '未知歌手'}`}
			>
				<div className="relative aspect-square overflow-hidden bg-surface-alt rounded mb-2.5">
					<SmartImage
						src={song.cover}
						alt={song.title + ' 封面'}
						className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
						lazy={false}
					/>
					{isCurrentSong && !isBatchMode && (
						<div className="absolute left-2 top-2 rounded bg-[var(--color-theme-accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
							{t('music.playing')}
						</div>
					)}
				</div>

				<div className={clsx(isSmallGrid ? "space-y-1" : "space-y-1.5")}>
					<p className={clsx(
						"font-semibold truncate tracking-[0.02em] transition-colors",
						isSmallGrid ? "text-[0.875rem]" : "text-[0.9375rem]",
						isCurrentSong ? "text-brand-gold" : "text-text-primary group-hover:text-brand-gold"
					)}>
						{song.title}
					</p>
					<p className={clsx(
						"text-text-muted truncate",
						isSmallGrid ? "text-[0.6875rem]" : "text-xs"
					)}>
						{song.artist}
					</p>
					{!isSmallGrid && (
						<p className="text-xs text-text-muted/80 truncate">{song.album}</p>
					)}
				</div>

				<div className="mt-2 flex min-h-8 items-center justify-between gap-2">
					{isBatchMode ? (
						renderBatchButton(true)
					) : (
						<div className="flex flex-wrap items-center gap-0.5">
							{renderActionButtons(isSmallGrid)}
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div
			onClick={handleRowClick}
			onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); } }}
			className={clsx(
				"gufeng-song-item group flex items-center gap-4 py-4 px-1 border-b border-border transition-all cursor-pointer",
				isCurrentSong && !isBatchMode && "bg-brand-gold/10",
				isBatchMode && isSelected && "bg-brand-gold/15"
			)}
			role="button"
			tabIndex={0}
			aria-label={`${song.title} - ${song.artist || '未知歌手'}`}
		>
			{/* Cover */}
			<div className="relative w-14 h-14 flex-shrink-0 pointer-events-none">
				<SmartImage
					src={song.cover}
					alt={song.title + ' 封面'}
					className="w-full h-full object-cover rounded"
					lazy={false}
				/>
			</div>

			{/* Info */}
			<div className="flex-1 min-w-0 pointer-events-none">
				<p className={clsx(
					"block text-[1.0625rem] font-semibold truncate tracking-[0.03em] transition-colors",
					isCurrentSong ? "text-brand-gold" : "text-text-primary group-hover:text-brand-gold"
				)}>
					{song.title}
				</p>
				<p className="text-[0.8125rem] text-text-muted truncate mt-0.5 flex items-center gap-2 flex-wrap">
					{song.artist}
					<span className="w-[3px] h-[3px] bg-border rounded-full inline-block" />
					{song.album}
				</p>
			</div>

			{/* Actions */}
			<div className="flex items-center gap-1 flex-shrink-0">
				{isBatchMode ? (
					renderBatchButton()
				) : (
					<>
						{/* Desktop actions: hidden by default, show on hover */}
						<div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
							{renderActionButtons()}
						</div>

						{/* Mobile actions: always visible but compact */}
						<div className="flex md:hidden items-center gap-0.5">
							<button
								onClick={(e) => { e.stopPropagation(); onToggleFavorite(song); }}
								disabled={isFavoriting}
								className={clsx(
									"p-2 rounded transition-colors",
									song.favoritedByMe ? "theme-text-error" : "text-text-muted"
								)}
							>
								<Heart size={15} />
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
});

export { SongCard };
export type { SongCardProps };
