import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showPageSizeSelector = false,
}) => {
  if (totalPages <= 0) return null;

  const handlePrev = () => {
    if (page > 1) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      onPageChange(page + 1);
    }
  };

  return (
    <footer className="px-6 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <p className="text-xs text-gray-400">
          第 {Math.min(page, totalPages)} / {totalPages} 页
        </p>
        {showPageSizeSelector && pageSize && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">每页</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-full px-2 py-1 text-gray-600 bg-white hover:bg-gray-50 cursor-pointer"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} 条
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrev}
          disabled={page <= 1}
          className={clsx(
            'inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full',
            'border border-gray-200 text-gray-600 hover:bg-gray-50',
            'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
          )}
        >
          <ChevronLeft size={14} /> 上一页
        </button>
        <button
          onClick={handleNext}
          disabled={page >= totalPages}
          className={clsx(
            'inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full',
            'border border-gray-200 text-gray-600 hover:bg-gray-50',
            'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
          )}
        >
          下一页 <ChevronRight size={14} />
        </button>
      </div>
    </footer>
  );
};

export default Pagination;
