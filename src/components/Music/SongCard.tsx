import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Heart, ExternalLink, ChevronRight, MessageSquare, Link2, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useI18n } from '../../lib/i18n';
import { SmartImage } from '../SmartImage';
import type { SongItem } from '../../types/entities';

const getSongExternalUrl = (song: SongItem) => {
	const id = (song.id || '').trim();
	if (!id) {
		return '#';
	}

	const platform = song.primaryPlatform || 'netease';
	if (platform === 'tencent') {
		return `https://y.qq.com/n/ryqq/songDetail/${id}`;
	}
	if (platform === 'kugou') {
		return `https://www.kugou.com/song/#hash=${id}`;
	}
	if (platform === 'kuwo') {
		return `https://www.kuwo.cn/play_detail/${id}`;
	}
	if (platform === 'baidu') {
		return `https://music.91q.com/#/song/${id}`;
	}
	return `https://music.163.com/song?id=${id}`;
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

	return (
		<div
			className={clsx(
				"gufeng-song-item group flex items-center gap-4 py-4 px-1 border-b border-[#e0dcd3] transition-all",
				isCurrentSong && !isBatchMode && "bg-[#fdf5d8]/40",
				isBatchMode && isSelected && "bg-[#fdf5d8]/60"
			)}
		>
			{/* Cover */}
			<div className="relative w-14 h-14 flex-shrink-0">
				<SmartImage
					src={song.cover}
					alt={song.title}
					className="w-full h-full object-cover rounded"
					lazy={false}
				/>
				<button
					onClick={() => onPlay(song)}
					className={clsx(
						"absolute inset-0 bg-black/30 flex items-center justify-center transition-all rounded",
						"md:opacity-0 md:group-hover:opacity-100",
						"opacity-100"
					)}
					title={t('music.play')}
				>
					<Play className="text-white" size={16} />
				</button>
			</div>

			{/* Info */}
			<div className="flex-1 min-w-0">
				<Link
					to={`/music/${song.docId}`}
					className={clsx(
						"block text-[1.0625rem] font-semibold truncate tracking-[0.03em] transition-colors",
						isCurrentSong ? "text-[#c8951e]" : "text-[#2c2c2c] group-hover:text-[#c8951e]"
					)}
				>
					{song.title}
				</Link>
				<p className="text-[0.8125rem] text-[#9e968e] truncate mt-0.5 flex items-center gap-2 flex-wrap">
					{song.artist}
					<span className="w-[3px] h-[3px] bg-[#e0dcd3] rounded-full inline-block" />
					{song.album}
				</p>
			</div>

			{/* Actions */}
			<div className="flex items-center gap-1 flex-shrink-0">
				{isBatchMode ? (
					<button
						onClick={() => onToggleSelect(song.docId)}
						className={clsx(
							"px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
							isSelected
								? "bg-[#c8951e] text-white"
								: "bg-[#f0ece3] text-[#6b6560] hover:text-[#c8951e]"
						)}
					>
						{isSelected ? t('music.selected') : t('music.select')}
					</button>
				) : (
					<>
						{/* Desktop actions: hidden by default, show on hover */}
						<div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
							<button
								onClick={() => onToggleFavorite(song)}
								disabled={isFavoriting}
								className={clsx(
									"p-2 rounded transition-colors",
									song.favoritedByMe ? "text-red-500" : "text-[#9e968e] hover:text-red-500"
								)}
								title={t('music.favorite')}
							>
								<Heart size={15} />
							</button>
							<a
								href={getSongExternalUrl(song)}
								target="_blank"
								rel="noopener noreferrer"
								className="p-2 text-[#9e968e] hover:text-[#c8951e] transition-colors"
								title={t('music.openOriginalLink')}
							>
								<ExternalLink size={15} />
							</a>
							<button
								onClick={(event) => onCopyLink(event, song)}
								className="p-2 text-[#9e968e] hover:text-[#c8951e] transition-colors"
								title={t('music.copyInternalLink')}
							>
								<Link2 size={15} />
							</button>
							<button
								onClick={() => onShowPosts(song)}
								className={clsx(
									"p-2 transition-colors",
									isPostsSelected ? "text-[#c8951e]" : "text-[#9e968e] hover:text-[#c8951e]"
								)}
								title={t('music.viewPosts')}
							>
								<MessageSquare size={15} />
							</button>
							{isAdmin && (
								<button
									onClick={() => onDelete(song.docId)}
									className="p-2 text-[#9e968e] hover:text-red-500 transition-colors"
									title={t('music.deleteSong')}
								>
									<Trash2 size={15} />
								</button>
							)}
						</div>

						{/* Mobile actions: always visible but compact */}
						<div className="flex md:hidden items-center gap-0.5">
							<button
								onClick={() => onToggleFavorite(song)}
								disabled={isFavoriting}
								className={clsx(
									"p-2 rounded transition-colors",
									song.favoritedByMe ? "text-red-500" : "text-[#9e968e]"
								)}
							>
								<Heart size={15} />
							</button>
							<Link
								to={`/music/${song.docId}`}
								className="p-2 text-[#9e968e]"
							>
								<ChevronRight size={15} />
							</Link>
						</div>

						{/* Arrow indicator (desktop only) */}
						<div className="hidden md:block text-[#c8951e] opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 -translate-x-1 ml-1">
							<ChevronRight size={18} />
						</div>
					</>
				)}
			</div>
		</div>
	);
});

export { SongCard };
export type { SongCardProps };
