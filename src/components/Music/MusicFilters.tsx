import React from 'react';
import { Plus } from 'lucide-react';
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
		<div className="border-b border-[#e0dcd3] pb-3 mb-2">
			<div className="flex flex-wrap items-center gap-2">
				{activeTab === 'music' && (
					<>
						{(['all', 'netease', 'tencent', 'kugou', 'baidu', 'kuwo'] as FilterPlatform[]).map((p) => (
							<button
								key={p}
								onClick={() => onFilterPlatformChange(p)}
								className={clsx(
									'px-3 py-1 text-[0.875rem] transition-all relative',
									filterPlatform === p
										? 'text-[#c8951e] font-semibold'
										: 'text-[#9e968e] hover:text-[#c8951e]'
								)}
							>
								{p === 'all' ? t('music.platforms.all') : t(`music.platforms.${p}`)}
								{filterPlatform === p && (
									<span className="absolute bottom-[-13px] left-0 right-0 h-[2px] bg-[#c8951e] rounded-[1px]" />
								)}
							</button>
						))}
					</>
				)}

				{activeTab === 'albums' && isAdmin && (
					<button
						onClick={onCreateAlbum}
						className="px-3 py-1 text-[0.875rem] text-[#c8951e] font-semibold hover:text-[#dca828] transition-all flex items-center gap-1"
					>
						<Plus size={14} /> {t('music.createAlbum')}
					</button>
				)}

				<div className="ml-auto flex items-center gap-3">
					{activeTab === 'music' && (
						<>
							<select
								value={sortBy}
								onChange={(e) => onSortByChange(e.target.value as SortBy)}
								className="px-2 py-1 bg-transparent border border-[#e0dcd3] rounded text-xs text-[#6b6560] focus:outline-none focus:border-[#c8951e]"
								style={{ fontFamily: 'inherit' }}
							>
								<option value="createdAt">{t('music.sortBy.createdAt')}</option>
								<option value="title">{t('music.sortBy.title')}</option>
								<option value="artist">{t('music.sortBy.artist')}</option>
							</select>
							<button
								onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
								className="px-2 py-1 border border-[#e0dcd3] rounded text-xs text-[#9e968e] hover:text-[#c8951e] hover:border-[#c8951e] transition-all"
								title={sortOrder === 'asc' ? t('music.sortOrder.asc') : t('music.sortOrder.desc')}
							>
								{sortOrder === 'desc' ? '↓' : '↑'}
							</button>
							<label className="flex items-center gap-1.5 text-xs text-[#9e968e] cursor-pointer select-none">
								<input
									type="checkbox"
									checked={showAccompaniments}
									onChange={(e) => onShowAccompanimentsChange(e.target.checked)}
									className="w-3.5 h-3.5 rounded border-[#e0dcd3] text-[#c8951e] focus:ring-[#c8951e]"
								/>
								<span className="hidden sm:inline">{t('music.showAccompaniments')}</span>
								<span className="sm:hidden" title={t('music.showAccompaniments')}>🎵</span>
							</label>
						</>
					)}
					<span className="text-xs font-semibold text-[#9e968e] uppercase tracking-[0.12em]">
						{activeTab === 'music' ? `${musicCount} ${t('music.unit.song')}` : `${albumCount} ${t('music.unit.album')}`}
					</span>
					<ViewModeSelector value={viewMode} onChange={onViewModeChange} size="sm" />
				</div>
			</div>
		</div>
	);
};

export { MusicFilters };
export type { MusicFiltersProps, SortBy, SortOrder, FilterPlatform, ActiveTab };
