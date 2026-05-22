import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Heart, ExternalLink, MessageSquare, Link2, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useI18n } from '../../lib/i18n';
import { getPlatformExternalUrl } from '../../lib/musicPlatformUrls';
import { SmartImage } from '../SmartImage';
import type { SongItem } from '../../types/entities';

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
	onPlay,
	onToggleSelect,
	onToggleFavorite,
	onCopyLink,
	onDelete,
	onShowPosts,
}: SongCardProps) {
	const { t } = useI18n();
	const navigate = useNavigate();

	const handleRowClick = () => {
		if (isBatchMode) {
			onToggleSelect(song.docId);
		} else {
			navigate(`/music/${song.docId}`);
		}
	};

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
					<button
						onClick={(e) => { e.stopPropagation(); onToggleSelect(song.docId); }}
						className={clsx(
							"px-3 py-1.5 rounded text-xs font-semibold transition-all",
							isSelected
								? "bg-[var(--color-theme-accent)] text-white"
								: "bg-surface-alt text-text-secondary hover:text-brand-gold"
						)}
					>
						{isSelected ? t('music.selected') : t('music.select')}
					</button>
				) : (
					<>
						{/* Desktop actions: hidden by default, show on hover */}
						<div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
							<button
							onClick={(e) => { e.stopPropagation(); onPlay(song); }}
							className="p-2 rounded text-text-muted hover:text-brand-gold transition-colors"
							title={t('music.play')}
							aria-label={`播放 ${song.title}`}
						>
								<Play size={15} />
							</button>
							<button
								onClick={(e) => { e.stopPropagation(); onToggleFavorite(song); }}
								disabled={isFavoriting}
								className={clsx(
									"p-2 rounded transition-colors",
									song.favoritedByMe ? "text-red-500" : "text-text-muted hover:text-red-500"
								)}
								title={t('music.favorite')}
							>
								<Heart size={15} />
							</button>
							<a
								href={getSongExternalUrl(song)}
								target="_blank"
								rel="noopener noreferrer"
								onClick={(e) => e.stopPropagation()}
								className="p-2 text-text-muted hover:text-brand-gold transition-colors"
								title={t('music.openOriginalLink')}
							>
								<ExternalLink size={15} />
							</a>
							<button
								onClick={(event) => { event.stopPropagation(); onCopyLink(event, song); }}
								className="p-2 text-text-muted hover:text-brand-gold transition-colors"
								title={t('music.copyInternalLink')}
							>
								<Link2 size={15} />
							</button>
							<button
								onClick={(e) => { e.stopPropagation(); onShowPosts(song); }}
								className={clsx(
									"p-2 transition-colors",
									isPostsSelected ? "text-brand-gold" : "text-text-muted hover:text-brand-gold"
								)}
								title={t('music.viewPosts')}
							>
								<MessageSquare size={15} />
							</button>
							{isAdmin && (
								<button
								onClick={(e) => { e.stopPropagation(); onDelete(song.docId); }}
								className="p-2 text-text-muted hover:text-red-500 transition-colors"
								title={t('music.deleteSong')}
								aria-label={`删除 ${song.title}`}
							>
									<Trash2 size={15} />
								</button>
							)}
						</div>

						{/* Mobile actions: always visible but compact */}
						<div className="flex md:hidden items-center gap-0.5">
							<button
								onClick={(e) => { e.stopPropagation(); onToggleFavorite(song); }}
								disabled={isFavoriting}
								className={clsx(
									"p-2 rounded transition-colors",
									song.favoritedByMe ? "text-red-500" : "text-text-muted"
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
