export type ContentStatus = 'draft' | 'pending' | 'published' | 'rejected';

export const splitTagsInput = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const getStatusText = (status?: ContentStatus): string => {
  if (status === 'pending') return '待审核';
  if (status === 'rejected') return '已驳回';
  if (status === 'draft') return '草稿';
  return '已发布';
};
