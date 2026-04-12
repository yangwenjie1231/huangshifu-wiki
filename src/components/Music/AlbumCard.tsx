import React from 'react';
import { Link } from 'react-router-dom';
import { List, ChevronRight, Link2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useI18n } from '../../lib/i18n';
import type { AlbumItem } from '../../types/entities';
import type { ViewMode } from '../../types/userPreferences';

interface AlbumCardProps {
	album: AlbumItem;
	viewMode: ViewMode;
	onCopyLink: (event: React.MouseEvent<HTMLButtonElement>, albumId: string) => void;
}

const AlbumCard = React.memo(function AlbumCard({
	album,
	viewMode,
	onCopyLink,
}: AlbumCardProps) {
	const { t } = useI18n();
	const albumId = album.docId || album.id;
	const trackCount = album.trackCount ?? album.tracks?.length ?? 0;

	return (
		<div className={clsx(
			viewMode === 'list'
				? 'flex gap-4 p-3 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all'
				: 'rounded-3xl border border-gray-100 p-4 hover:border-brand-primary/30 hover:shadow-md transition-all bg-white group'
		)}>
			{viewMode === 'list' ? (
				<>
					<div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
						<img src={album.cover} alt={album.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
					</div>
					<div className="flex-1 min-w-0 flex items-center">
						<div className="flex-1 min-w-0">
							<Link to={`/album/${albumId}`} className="font-bold text-gray-900 line-clamp-1 hover:text-brand-primary transition-colors">
								{album.title}
							</Link>
							<p className="text-xs text-gray-400 line-clamp-1">{album.artist}</p>
						</div>
						<div className="flex items-center gap-2 flex-shrink-0">
							<span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{trackCount} {t('music.unit.song')}</span>
							<Link
								to={`/album/${albumId}`}
								className="px-3 py-1.5 rounded-full bg-brand-primary/15 text-gray-900 text-xs hover:bg-brand-primary/25 transition-colors"
							>
								{t('music.view')}
							</Link>
						</div>
					</div>
				</>
			) : (
				<>
					<Link to={`/album/${albumId}`} className="block relative aspect-square rounded-2xl overflow-hidden bg-gray-100">
						<img src={album.cover} alt={album.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
						<div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-80" />
						<div className="absolute left-3 bottom-3 inline-flex items-center gap-1 text-xs text-white bg-black/60 rounded-full px-3 py-1.5">
							<List size={13} /> {trackCount} {t('music.unit.song')}
						</div>
					</Link>

					<div className="mt-4">
						<Link to={`/album/${albumId}`} className="font-bold text-gray-900 line-clamp-1 hover:text-brand-primary transition-colors">
							{album.title}
						</Link>
						<p className="text-xs text-gray-400 mt-1 line-clamp-1">{album.artist}</p>
					</div>

					<div className="mt-3 flex items-center justify-between">
						<Link
							to={`/album/${albumId}`}
							className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-brand-primary/15 text-gray-900 hover:bg-brand-primary/25 transition-colors"
						>
							{t('music.viewAlbum')} <ChevronRight size={14} />
						</Link>
						<button
							onClick={(event) => onCopyLink(event, albumId)}
							className="p-2 text-gray-400 hover:text-brand-primary transition-colors"
							title={t('music.copyAlbumLink')}
						>
							<Link2 size={16} />
						</button>
					</div>
				</>
			)}
		</div>
	);
});

export { AlbumCard };
export type { AlbumCardProps };
