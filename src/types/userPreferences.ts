export type ViewMode = 'large' | 'medium' | 'small' | 'list';

export interface UserPreferences {
  viewMode: ViewMode;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  viewMode: 'medium',
};
