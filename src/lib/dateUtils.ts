import { format } from 'date-fns';

export const toDateValue = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDate = (value: string | null | undefined, pattern: string): string => {
  const parsed = toDateValue(value);
  return parsed ? format(parsed, pattern) : '刚刚';
};

export const formatDateTime = (
  value: string | null | undefined,
  fallback = '刚刚',
): string => {
  const parsed = toDateValue(value);
  return parsed ? format(parsed, 'yyyy-MM-dd HH:mm') : fallback;
};
