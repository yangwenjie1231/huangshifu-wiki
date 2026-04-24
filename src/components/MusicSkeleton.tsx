import React from "react";

export const MusicSkeleton: React.FC = () => {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: '#f7f5f0',
        color: '#2c2c2c',
        fontFamily: "'Noto Serif SC', 'Source Han Serif SC', 'SimSun', 'STSong', 'FangSong', serif",
      }}
    >
      <div className="max-w-[1100px] mx-auto px-6 py-8 pb-32">
        {/* Header */}
        <header className="mb-7">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div className="flex items-baseline gap-4">
              <div className="h-8 w-32 bg-[#f0ece3] rounded animate-pulse" />
              <div className="h-5 w-48 bg-[#f0ece3] rounded animate-pulse" />
            </div>
            <div className="flex gap-3">
              <div className="h-9 w-24 bg-[#f0ece3] rounded-full animate-pulse" />
              <div className="h-9 w-24 bg-[#f0ece3] rounded-full animate-pulse" />
            </div>
          </div>
        </header>

        {/* Two Column */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">
          {/* Main */}
          <div>
            {/* Sub Nav */}
            <div className="flex gap-6 border-b border-[#e0dcd3] pb-0.5 mb-6">
              <div className="h-7 w-16 bg-[#f0ece3] rounded animate-pulse mb-2.5" />
              <div className="h-7 w-16 bg-[#f0ece3] rounded animate-pulse mb-2.5" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6 border-b border-[#e0dcd3] pb-3">
              <div className="h-7 w-20 bg-[#f0ece3] rounded animate-pulse" />
              <div className="h-7 w-20 bg-[#f0ece3] rounded animate-pulse" />
              <div className="h-7 w-20 bg-[#f0ece3] rounded animate-pulse" />
              <div className="h-7 w-20 bg-[#f0ece3] rounded animate-pulse ml-auto" />
            </div>

            {/* Song List */}
            <div className="flex flex-col">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-4 px-1 border-b border-[#e0dcd3]">
                  <div className="w-14 h-14 bg-[#f0ece3] rounded animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-4 w-1/2 bg-[#f0ece3] rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-[#f0ece3] rounded animate-pulse" />
                  </div>
                  <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                    <div className="h-8 w-8 bg-[#f0ece3] rounded-full animate-pulse" />
                    <div className="h-8 w-8 bg-[#f0ece3] rounded-full animate-pulse" />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex justify-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 w-9 bg-[#f0ece3] rounded animate-pulse" />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside>
            <div className="py-5 border-b border-[#e0dcd3]">
              <div className="h-4 w-24 bg-[#f0ece3] rounded animate-pulse mb-3.5" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#f0ece3] rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 bg-[#f0ece3] rounded animate-pulse" />
                  <div className="h-2.5 w-1/2 bg-[#f0ece3] rounded animate-pulse" />
                </div>
              </div>
            </div>
            <div className="py-5 border-b border-[#e0dcd3]">
              <div className="h-4 w-24 bg-[#f0ece3] rounded animate-pulse mb-3.5" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-[#f0ece3] rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-[#f0ece3] rounded animate-pulse" />
                <div className="h-3 w-4/6 bg-[#f0ece3] rounded animate-pulse" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default MusicSkeleton;
