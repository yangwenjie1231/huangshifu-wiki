import React from "react";
import { Skeleton } from "./Skeleton";

export const MusicSkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <header className="mb-8 md:mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Skeleton variant="rectangular" width={48} height={48} className="rounded-xl" />
            <Skeleton width={200} height={48} />
          </div>
          <Skeleton width={300} height={20} />
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12">
        {/* Songs List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Tabs */}
            <div className="p-4 md:p-6 lg:p-8 border-b border-gray-50">
              <div className="inline-flex bg-gray-100 rounded-full p-1.5">
                <Skeleton width={80} height={36} className="rounded-full" />
                <Skeleton width={80} height={36} className="rounded-full ml-2" />
              </div>
            </div>

            {/* Search & Filters */}
            <div className="p-4 md:p-6 lg:p-8 border-b border-gray-50">
              <div className="flex flex-col sm:flex-row gap-4">
                <Skeleton width="100%" height={48} className="rounded-2xl" />
                <div className="flex gap-2">
                  <Skeleton width={120} height={48} className="rounded-2xl" />
                  <Skeleton width={120} height={48} className="rounded-2xl" />
                </div>
              </div>
            </div>

            {/* Song List */}
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-4 md:p-6 lg:p-8 flex items-center gap-4 md:gap-6">
                  <Skeleton variant="rectangular" width={48} height={48} className="rounded-xl flex-shrink-0" />
                  <div className="flex-grow min-w-0 space-y-2">
                    <Skeleton width="60%" height={20} />
                    <Skeleton width="40%" height={16} />
                  </div>
                  <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                    <Skeleton width={40} height={20} />
                    <Skeleton width={40} height={20} />
                  </div>
                  <Skeleton variant="rectangular" width={80} height={32} className="rounded-full flex-shrink-0" />
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="p-4 md:p-6 lg:p-8 border-t border-gray-50">
              <div className="flex justify-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} width={40} height={40} className="rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Albums Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 md:p-6 border-b border-gray-50">
              <Skeleton width={150} height={32} />
            </div>
            <div className="p-4 md:p-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton variant="rectangular" width={56} height={56} className="rounded-xl flex-shrink-0" />
                  <div className="flex-grow space-y-2">
                    <Skeleton width="80%" height={18} />
                    <Skeleton width="50%" height={14} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 rounded-2xl md:rounded-3xl border border-brand-primary/20 p-4 md:p-6">
            <Skeleton width={120} height={24} className="mb-4" />
            <div className="space-y-3">
              <div className="flex justify-between">
                <Skeleton width={80} height={16} />
                <Skeleton width={60} height={16} />
              </div>
              <div className="flex justify-between">
                <Skeleton width={80} height={16} />
                <Skeleton width={60} height={16} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicSkeleton;
