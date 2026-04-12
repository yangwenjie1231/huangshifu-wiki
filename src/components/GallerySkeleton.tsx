import React from "react";
import { Skeleton } from "./Skeleton";

export const GallerySkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <Skeleton width={200} height={48} className="mb-2" />
          <Skeleton width={250} height={20} />
        </div>
        <Skeleton width={150} height={48} className="rounded-full" />
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Cover */}
            <Skeleton variant="rectangular" height={200} />
            
            {/* Content */}
            <div className="p-6 space-y-3">
              <Skeleton width="80%" height={24} />
              <Skeleton width="60%" height={16} />
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton width={100} height={16} />
                </div>
                <Skeleton width={80} height={16} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={40} height={40} className="rounded-lg" />
        ))}
      </div>
    </div>
  );
};

export default GallerySkeleton;
