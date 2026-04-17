import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Heart, ExternalLink, ChevronRight, MessageSquare, Link2, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useI18n } from '../../lib/i18n';
import { SmartImage } from '../SmartImage';
import type { SongItem } from '../../types/entities';
import type { ViewMode } from '../../types/userPreferences';

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
	viewMode: ViewMode;
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
	viewMode,
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
				viewMode === 'list'
					? 'flex gap-3 md:gap-4 p-3 rounded-lg md:rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all'
					: 'rounded-xl md:rounded-2xl border transition-all p-3 md:p-4 group bg-white',
				isCurrentSong && !isBatchMode && viewMode !== 'list' ? 'border-brand-primary/40 shadow-lg shadow-brand-primary/10' : 'border-gray-100 hover:border-brand-primary/30 hover:shadow-md',
				isBatchMode && isSelected && 'border-brand-primary bg-brand-primary/5',
			)}
		>
			{viewMode === 'list' ? (
				<>
					<div className="relative w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
					<SmartImage src={song.cover} alt={song.title} className="w-full h-full object-cover" lazy={false} />
						<button
							onClick={() => onPlay(song)}
							className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
							title={t('music.play')}
						>
							<Play className="text-white text-[16px] md:text-[18px]" />
						</button>
					</div>
					<div className="flex-1 min-w-0 flex items-center">
						<div className="flex-1 min-w-0">
							<Link to={`/music/${song.docId}`} className="font-bold text-gray-900 line-clamp-1 hover:text-brand-primary transition-colors text-sm md:text-base">
								{song.title}
							</Link>
							<p className="text-xs text-gray-400 line-clamp-1">{song.artist} — {song.album}</p>
						</div>
						<div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
							{isBatchMode ? (
								<button
									onClick={() => onToggleSelect(song.docId)}
									className={clsx(
										'px-2.5 md:px-3 py-1.5 rounded-full text-xs font-bold transition-all touch-target-lg',
										isSelected ? 'bg-brand-primary text-gray-900' : 'bg-gray-100 text-gray-500',
									)}
								>
									{isSelected ? t('music.selected') : t('music.select')}
								</button>
							) : (
								<>
									<button
										onClick={() => onToggleFavorite(song)}
										disabled={isFavoriting}
										className={clsx(
											'p-1.5 md:p-2 transition-colors touch-target-lg',
											song.favoritedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-500',
										)}
										title={t('music.favorite')}
									>
										<Heart size={14} />
									</button>
									<Link
										to={`/music/${song.docId}`}
										className="px-2.5 md:px-3 py-1.5 rounded-full bg-black/60 text-white text-xs hover:bg-black/75 transition-colors"
										title={t('music.detail')}
									>
										{t('music.detail')}
									</Link>
								</>
							)}
						</div>
					</div>
				</>
			) : (
				<>
				<div className="relative aspect-square rounded-xl md:rounded-2xl overflow-hidden bg-gray-100">
					<SmartImage src={song.cover} alt={song.title} className="w-full h-full object-cover" lazy={false} />
						<div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-90" />
						<div className="absolute left-2.5 right-2.5 bottom-2.5 md:left-3 md:right-3 md:bottom-3 flex items-center justify-between gap-2">
							<button
								onClick={() => onPlay(song)}
								className={clsx(
									'w-9 h-9 md:w-10 md:h-10 rounded-full inline-flex items-center justify-center transition-all',
									isBatchMode ? 'bg-white/80 text-gray-900 hover:bg-white' : 'bg-brand-primary text-gray-900 hover:scale-105',
								)}
								title={isBatchMode ? t('music.selectSong') : t('music.playSong')}
							>
								<Play className={clsx('text-[14px] md:text-[16px]', !isBatchMode && isCurrentSong && 'fill-current')} />
							</button>
							<Link
								to={`/music/${song.docId}`}
								className="inline-flex items-center gap-1 text-xs px-2 py-1.5 md:px-3 md:py-2 rounded-full bg-black/60 text-white hover:bg-black/75 transition-colors"
								title={t('music.viewSongDetail')}
							>
								{t('music.detail')} <ChevronRight size={12} />
							</Link>
						</div>
					</div>

					<div className="mt-3 md:mt-4">
						<Link to={`/music/${song.docId}`} className="font-bold text-gray-900 line-clamp-1 hover:text-brand-primary transition-colors text-sm md:text-base" title={t('music.viewSongDetail')}>
							{song.title}
						</Link>
						<p className="text-xs text-gray-400 mt-1 line-clamp-1">{song.artist} — {song.album}</p>
						{song.platformIds && (
							<div className="flex items-center gap-1.5 mt-2">
								{song.platformIds.neteaseId && (
									<a
										href={`https://music.163.com/song?id=${song.platformIds.neteaseId}`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs px-2 py-0.5 sm:px-2 sm:py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors w-8 sm:w-auto flex items-center justify-center sm:justify-start"
										title={`${t('music.platforms.netease')}: ${song.platformIds.neteaseId}`}
									>
										<span className="hidden sm:inline">{t('music.platforms.netease')}</span>
										<span className="sm:hidden font-bold">云</span>
									</a>
								)}
								{song.platformIds.tencentId && (
									<a
										href={`https://y.qq.com/n/ryqq/songDetail/${song.platformIds.tencentId}`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs px-2 py-0.5 sm:px-2 sm:py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors w-8 sm:w-auto flex items-center justify-center sm:justify-start"
										title={`${t('music.platforms.tencent')}: ${song.platformIds.tencentId}`}
									>
										<span className="hidden sm:inline">QQ音乐</span>
										<span className="sm:hidden font-bold">Q</span>
									</a>
								)}
							</div>
						)}
					</div>

					<div
						className={clsx(
							'mt-4',
							viewMode === 'small'
								? 'flex items-center justify-between'
								: 'flex items-center justify-between',
						)}
					>
						{isBatchMode ? (
							<button
								onClick={() => onToggleSelect(song.docId)}
								className={clsx(
									'px-3 py-1.5 rounded-full text-xs font-bold transition-all',
									isSelected ? 'bg-brand-primary text-gray-900' : 'bg-gray-100 text-gray-500 hover:text-gray-800',
								)}
							>
								{isSelected ? t('music.selected') : t('music.select')}
							</button>
						) : (
							<div className={clsx(
								'flex items-center gap-1',
								viewMode === 'small' ? 'overflow-hidden' : 'flex-wrap'
							)}>
								<button
									onClick={() => onToggleFavorite(song)}
									disabled={isFavoriting}
									className={clsx(
										'p-2 transition-colors shrink-0',
										song.favoritedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-500',
										isFavoriting && 'opacity-50 cursor-not-allowed',
									)}
									title={t('music.favorite')}
								>
									<Heart size={16} />
								</button>
								<a
									href={getSongExternalUrl(song)}
									target="_blank"
									rel="noopener noreferrer"
									className="p-2 text-gray-400 hover:text-brand-primary transition-colors shrink-0"
									title={t('music.openOriginalLink')}
								>
									<ExternalLink size={16} />
								</a>
								<button
									onClick={(event) => onCopyLink(event, song)}
									className="p-2 text-gray-400 hover:text-brand-primary transition-colors shrink-0"
									title={t('music.copyInternalLink')}
								>
									<Link2 size={16} />
								</button>
								<button
									onClick={() => onShowPosts(song)}
									className={clsx(
										'p-2 transition-colors shrink-0',
										viewMode === 'small' ? 'hidden sm:inline-flex' : 'inline-flex',
										isPostsSelected ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary',
									)}
									title={t('music.viewPosts')}
								>
									<MessageSquare size={16} />
								</button>
							</div>
						)}

						{isAdmin && !isBatchMode ? (
							<button
								onClick={() => onDelete(song.docId)}
								className="p-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
								title={t('music.deleteSong')}
							>
								<Trash2 size={16} />
							</button>
						) : null}
					</div>
				</>
			)}
		</div>
	);
});

export { SongCard };
export type { SongCardProps };
