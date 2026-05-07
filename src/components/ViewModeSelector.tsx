import React from 'react';
import { LayoutGrid, Grid3X3, Grid2x2, List } from 'lucide-react';
import { clsx } from 'clsx';
import { ViewMode } from '../types/userPreferences';

interface ViewModeSelectorProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  size?: 'sm' | 'md';
}

const VIEW_MODE_CONFIG_UI: Record<ViewMode, { label: string; icon: React.ReactNode; iconSize: number }> = {
  large: { label: '舒适', icon: <LayoutGrid size={20} />, iconSize: 20 },
  medium: { label: '标准', icon: <Grid3X3 size={17} />, iconSize: 17 },
  small: { label: '紧凑', icon: <Grid2x2 size={14} />, iconSize: 14 },
  list: { label: '列表', icon: <List size={16} />, iconSize: 16 },
};

export const ViewModeSelector: React.FC<ViewModeSelectorProps> = ({ value, onChange, size = 'md' }) => {
  const modes: ViewMode[] = ['large', 'medium', 'small', 'list'];
  const showLabels = size === 'md';

  return (
    <div className={clsx(
      'inline-flex border border-[#e0dcd3] bg-white rounded p-0.5',
      size === 'sm' ? 'gap-0.5' : 'gap-1'
    )}>
      {modes.map((mode) => {
        const config = VIEW_MODE_CONFIG_UI[mode];
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            aria-label={config.label}
            className={clsx(
              'rounded transition-all inline-flex items-center gap-1.5 font-medium',
              size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-sm',
              value === mode
                ? 'bg-[#c8951e] text-white'
                : 'text-[#9e968e] hover:text-[#6b6560]'
            )}
            title={config.label}
          >
            {config.icon}
            {showLabels && <span className="hidden sm:inline">{config.label}</span>}
          </button>
        );
      })}
    </div>
  );
};
