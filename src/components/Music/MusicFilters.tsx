import React from 'react';
import { Plus, Album, Grid3X3 } from 'lucide-react';
import { clsx } from 'clsx';
import { ViewModeSelector } from '../ViewModeSelector';
import { useI18n } from '../../lib/i18n';
import type { ViewMode } from '../../types/userPreferences';

type SortBy = 'createdAt' | 'title' | 'artist';
type SortOrder = 'asc' | 'desc';
type FilterPlatform = 'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo' | 'all';
type ActiveTab = 'music' | 'albums';

interface MusicFiltersProps {
	activeTab: ActiveTab;
	onTabChange: (tab: ActiveTab) => void;
	viewMode: ViewMode;
	onViewModeChange: (mode: ViewMode) => void;
	isAdmin: boolean;
	onCreateAlbum: () => void;
	sortBy: SortBy;
	onSortByChange: (sortBy: SortBy) => void;
	sortOrder: SortOrder;
	onSortOrderChange: (order: SortOrder) => void;
	filterPlatform: FilterPlatform;
	onFilterPlatformChange: (platform: FilterPlatform) => void;
	showAccompaniments: boolean;
	onShowAccompanimentsChange: (show: boolean) => void;
	musicCount: number;
	albumCount: number;
}

const MusicFilters: React.FC<MusicFiltersProps> = ({
	activeTab,
	onTabChange,
	viewMode,
	onViewModeChange,
	isAdmin,
	onCreateAlbum,
	sortBy,
	onSortByChange,
	sortOrder,
	onSortOrderChange,
	filterPlatform,
	onFilterPlatformChange,
	showAccompaniments,
	onShowAccompanimentsChange,
	musicCount,
	albumCount,
}) => {
	const { t } = useI18n();

	return (
		<div className="p-4 md:p-6 lg:p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div className="inline-flex bg-gray-100 rounded-full p-1.5">
				<button
					onClick={() => onTabChange('music')}
					className={clsx(
						'px-5 py-2 rounded-full text-sm font-bold transition-all inline-flex items-center gap-2',
						activeTab === 'music' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
					)}
				>
					<Grid3X3 size={16} /> {t('music.tabMusic')}
				</button>
				<button
					onClick={() => onTabChange('albums')}
					className={clsx(
						'px-5 py-2 rounded-full text-sm font-bold transition-all inline-flex items-center gap-2',
						activeTab === 'albums' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
					)}
				>
					<Album size={16} /> {t('music.tabAlbums')}
				</button>
			</div>
			<div className="flex flex-wrap items-center gap-2 sm:gap-3">
				{isAdmin && activeTab === 'albums' && (
					<button
						onClick={onCreateAlbum}
						className="px-4 py-2 rounded-full bg-brand-primary text-gray-900 text-xs font-bold hover:scale-105 transition-all"
					>
						<Plus size={14} className="inline mr-1" /> {t('music.createAlbum')}
					</button>
				)}
				<ViewModeSelector value={viewMode} onChange={onViewModeChange} size="sm" />
				{activeTab === 'music' && (
					<>
						<select
							value={sortBy}
							onChange={(e) => onSortByChange(e.target.value as SortBy)}
							className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white min-w-[100px]"
						>
							<option value="createdAt">{t('music.sortBy.createdAt')}</option>
							<option value="title">{t('music.sortBy.title')}</option>
							<option value="artist">{t('music.sortBy.artist')}</option>
						</select>
						<button
							onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
							className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
							title={sortOrder === 'asc' ? t('music.sortOrder.asc') : t('music.sortOrder.desc')}
						>
							{sortOrder === 'desc' ? '↓' : '↑'}
						</button>
						<select
							value={filterPlatform}
							onChange={(e) => onFilterPlatformChange(e.target.value as FilterPlatform)}
							className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white min-w-[90px]"
						>
							<option value="all">{t('music.platforms.all')}</option>
							<option value="netease">{t('music.platforms.netease')}</option>
							<option value="tencent">{t('music.platforms.tencent')}</option>
							<option value="kugou">{t('music.platforms.kugou')}</option>
							<option value="baidu">{t('music.platforms.baidu')}</option>
							<option value="kuwo">{t('music.platforms.kuwo')}</option>
						</select>
						<label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
							<input
								type="checkbox"
								checked={showAccompaniments}
								onChange={(e) => onShowAccompanimentsChange(e.target.checked)}
								className="w-3.5 h-3.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
							/>
							<span className="hidden sm:inline">{t('music.showAccompaniments')}</span>
							<span className="sm:hidden" title={t('music.showAccompaniments')}>🎵</span>
						</label>
					</>
				)}
				<span className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-auto">
					{activeTab === 'music' ? `${musicCount} ${t('music.unit.song')}` : `${albumCount} ${t('music.unit.album')}`}
				</span>
			</div>
		</div>
	);
};

export { MusicFilters };
export type { MusicFiltersProps, SortBy, SortOrder, FilterPlatform, ActiveTab };
