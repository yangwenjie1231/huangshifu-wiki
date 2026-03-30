import { ViewMode } from '../types/userPreferences';

export interface ViewModeConfig {
  gridCols: string;
  cardHeight: string;
  gap: string;
  iconSize: number;
}

export const VIEW_MODE_CONFIG: Record<ViewMode, ViewModeConfig> = {
  large: {
    gridCols: 'grid-cols-2 md:grid-cols-3',
    cardHeight: 'h-[280px]',
    gap: 'gap-6',
    iconSize: 20,
  },
  medium: {
    gridCols: 'grid-cols-3 md:grid-cols-4',
    cardHeight: 'h-[180px]',
    gap: 'gap-4',
    iconSize: 18,
  },
  small: {
    gridCols: 'grid-cols-5 md:grid-cols-6',
    cardHeight: 'h-[100px]',
    gap: 'gap-3',
    iconSize: 16,
  },
  list: {
    gridCols: 'grid-cols-1',
    cardHeight: 'h-auto',
    gap: 'gap-2',
    iconSize: 16,
  },
};

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  large: '大图标',
  medium: '中图标',
  small: '小图标',
  list: '列表',
};
