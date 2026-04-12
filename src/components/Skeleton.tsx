import React from "react";
import { clsx } from "clsx";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = "text",
  width,
  height,
  animation = "pulse",
}) => {
  const baseClasses = "bg-gray-200";

  const variantClasses = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-none",
    rounded: "rounded-xl",
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-[wave_1.5s_ease-in-out_infinite]",
    none: "",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={clsx(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
    />
  );
};

export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}> = ({ lines = 3, className, lastLineWidth = "60%" }) => (
  <div className={clsx("space-y-3", className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        className={i === lines - 1 ? lastLineWidth : "w-full"}
      />
    ))}
  </div>
);

export const SkeletonAvatar: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <Skeleton variant="circular" width={size} height={size} />
);

export const SkeletonButton: React.FC<{
  width?: number;
  height?: number;
}> = ({ width = 120, height = 40 }) => (
  <Skeleton variant="rounded" width={width} height={height} />
);

export const SkeletonImage: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
}> = ({ width = "100%", height = 200, borderRadius = "16px" }) => (
  <Skeleton
    variant="rounded"
    width={width}
    height={height}
    className={borderRadius}
  />
);

export const SkeletonCard: React.FC = () => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
    <Skeleton variant="rounded" height={160} />
    <SkeletonText lines={2} />
    <div className="flex items-center gap-3">
      <Skeleton variant="circular" width={32} height={32} />
      <Skeleton variant="text" width={100} />
    </div>
  </div>
);

export const SkeletonListItem: React.FC = () => (
  <div className="flex items-center gap-4 p-4">
    <Skeleton variant="circular" width={48} height={48} />
    <div className="flex-1 space-y-2">
      <Skeleton variant="text" width="70%" />
      <Skeleton variant="text" width="40%" />
    </div>
  </div>
);

export const PageSkeleton: React.FC<{
  type?: "list" | "detail" | "grid" | "profile";
}> = ({ type = "list" }) => {
  if (type === "grid") {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (type === "detail") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <Skeleton variant="rounded" height={300} />
        <div className="space-y-4">
          <Skeleton variant="text" width="60%" height={32} />
          <SkeletonText lines={4} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </div>
      </div>
    );
  }

  if (type === "profile") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-center gap-6">
          <Skeleton variant="circular" width={96} height={96} />
          <div className="flex-1 space-y-3">
            <Skeleton variant="text" width={200} height={28} />
            <Skeleton variant="text" width={150} />
          </div>
        </div>
        <Skeleton variant="rounded" height={200} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonListItem key={i} />
        ))}
      </div>
    </div>
  );
};

export default Skeleton;
