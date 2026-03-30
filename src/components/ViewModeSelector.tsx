import React from 'react';
import { LayoutGrid, Grid3X3, Grid2x2, List } from 'lucide-react';
import { clsx } from 'clsx';
import { ViewMode } from '../types/userPreferences';
import { VIEW_MODE_LABELS } from '../lib/viewModes';

interface ViewModeSelectorProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  size?: 'sm' | 'md';
}

const VIEW_MODE_ICONS: Record<ViewMode, React.ReactNode> = {
  large: <LayoutGrid size={18} />,
  medium: <Grid3X3 size={18} />,
  small: <Grid2x2 size={18} />,
  list: <List size={18} />,
};

export const ViewModeSelector: React.FC<ViewModeSelectorProps> = ({ value, onChange, size = 'md' }) => {
  const modes: ViewMode[] = ['large', 'medium', 'small', 'list'];

  return (
    <div className={clsx(
      'inline-flex bg-gray-100 rounded-full p-1',
      size === 'sm' ? 'gap-0.5' : 'gap-1'
    )}>
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={clsx(
            'rounded-full transition-all inline-flex items-center gap-1.5 font-medium',
            size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
            value === mode
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
          title={VIEW_MODE_LABELS[mode]}
        >
          {VIEW_MODE_ICONS[mode]}
          {size === 'md' && <span>{VIEW_MODE_LABELS[mode]}</span>}
        </button>
      ))}
    </div>
  );
};
