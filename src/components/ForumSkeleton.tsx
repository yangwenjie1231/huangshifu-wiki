import React from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "./Skeleton";

export const ForumSkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <Skeleton width={250} height={48} className="mb-2" />
          <Skeleton width={300} height={20} />
        </div>
        <Skeleton width={150} height={48} className="rounded-full" />
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={100} height={36} className="rounded-full" />
        ))}
      </div>

      {/* Sort Tabs */}
      <div className="flex items-center gap-2 mb-12 border-b border-gray-100 pb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width={80} height={32} className="rounded-lg" />
        ))}
      </div>

      {/* Post List */}
      <div className="space-y-4 mb-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              {/* User Avatar */}
              <Skeleton variant="circular" width={48} height={48} />
              
              {/* Content */}
              <div className="flex-grow space-y-3">
                {/* Section & Time */}
                <div className="flex items-center gap-2">
                  <Skeleton width={80} height={20} className="rounded" />
                  <Skeleton width={100} height={16} />
                </div>
                
                {/* Title */}
                <Skeleton width="70%" height={28} />
                
                {/* Excerpt */}
                <Skeleton width="90%" height={18} />
                
                {/* Stats */}
                <div className="flex items-center gap-6 pt-2">
                  <Skeleton width={60} height={16} />
                  <Skeleton width={60} height={16} />
                  <Skeleton width={80} height={16} />
                </div>
              </div>

              {/* Thumbnail */}
              <Skeleton variant="rectangular" width={120} height={80} className="rounded-xl flex-shrink-0" />
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

export default ForumSkeleton;
