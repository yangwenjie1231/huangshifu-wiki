import React from "react";
import { Link } from "react-router-dom";
import { Skeleton, SkeletonText } from "./Skeleton";

export const HomeSkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-[500px] rounded-[40px] overflow-hidden mb-12 shadow-2xl bg-gradient-to-br from-brand-primary/35 via-white/20 to-black/30">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12 sm:p-20">
          <div className="space-y-6">
            <div>
              <Skeleton width={400} height={80} className="mb-4" />
              <Skeleton width={250} height={36} />
            </div>
            <Skeleton width={500} height={28} />
            <div className="flex flex-wrap gap-4 mt-8">
              <Skeleton width={160} height={56} className="rounded-full" />
              <Skeleton width={200} height={56} className="rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Layout */}
      <section className="bento-grid mb-16">
        {/* 百科全书 */}
        <div className="bento-item-large liquidGlass-wrapper bg-white">
          <div className="liquidGlass-effect"></div>
          <div className="liquidGlass-tint"></div>
          <div className="liquidGlass-shine"></div>
          <div className="liquidGlass-text w-full p-6 sm:p-8">
            <div className="flex justify-between items-end mb-8">
              <div>
                <Skeleton width={200} height={40} className="mb-2" />
                <Skeleton width={150} height={20} />
              </div>
              <Skeleton width={100} height={20} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl">
                  <Skeleton variant="rectangular" width={32} height={32} className="rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton width="80%" height={24} />
                    <Skeleton width="100%" height={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 热门帖子 */}
        <div className="bento-item-tall liquidGlass-wrapper bg-white">
          <div className="liquidGlass-effect"></div>
          <div className="liquidGlass-tint"></div>
          <div className="liquidGlass-shine"></div>
          <div className="liquidGlass-text w-full p-6 sm:p-8 flex flex-col h-full">
            <div className="flex justify-between items-end mb-6">
              <Skeleton width={150} height={32} />
              <Skeleton width={80} height={20} />
            </div>
            <div className="space-y-4 flex-grow">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 rounded-2xl bg-brand-primary/5 border border-brand-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton width={60} height={20} className="rounded" />
                  </div>
                  <Skeleton width="90%" height={20} className="mb-2" />
                  <div className="flex items-center gap-4">
                    <Skeleton width={40} height={16} />
                    <Skeleton width={40} height={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 社区动态 */}
        <div className="bento-item-large liquidGlass-wrapper bg-white">
          <div className="liquidGlass-effect"></div>
          <div className="liquidGlass-tint"></div>
          <div className="liquidGlass-shine"></div>
          <div className="liquidGlass-text w-full p-6 sm:p-8">
            <div className="flex justify-between items-end mb-6">
              <Skeleton width={180} height={36} />
              <Skeleton width={80} height={20} />
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-2xl bg-white border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton width={60} height={20} className="rounded" />
                    <Skeleton width={80} height={16} />
                  </div>
                  <Skeleton width="85%" height={24} className="mb-2" />
                  <div className="flex items-center gap-4">
                    <Skeleton width={30} height={16} />
                    <Skeleton width={30} height={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 加入我们 */}
        <div className="bento-item-tall liquidGlass-wrapper bg-gradient-to-br from-brand-primary to-brand-primary/80">
          <div className="liquidGlass-effect"></div>
          <div className="liquidGlass-tint"></div>
          <div className="liquidGlass-shine"></div>
          <div className="liquidGlass-text w-full p-6 sm:p-8 text-gray-900 flex flex-col justify-between h-full">
            <div>
              <Skeleton width={150} height={36} className="mb-6 bg-white/20" />
              <Skeleton width="100%" height={60} className="mb-4" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-white/20 rounded-2xl">
                <Skeleton variant="circular" width={40} height={40} className="bg-white/40" />
                <div className="flex-1 space-y-2">
                  <Skeleton width="50%" height={20} />
                  <Skeleton width="30%" height={14} />
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/20 rounded-2xl">
                <Skeleton variant="circular" width={40} height={40} className="bg-white/40" />
                <div className="flex-1 space-y-2">
                  <Skeleton width="50%" height={20} />
                  <Skeleton width="30%" height={14} />
                </div>
              </div>
              <Skeleton width="100%" height={48} className="rounded-full mt-4" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomeSkeleton;
