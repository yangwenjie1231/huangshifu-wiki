import React from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import {
  Image as ImageIcon,
  Book,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Clock,
} from "lucide-react";
import { SmartImage } from "./SmartImage";
import { withThemeSearch } from "../lib/theme";
import type { ThemeName } from "../lib/theme";
import type { MixedSearchResult, ImageSourceType } from "../hooks/useSearch";
import type { GalleryItem, WikiItem, PostItem } from "../types/entities";
import { format } from "date-fns";
import { toDateValue } from "../lib/dateUtils";

interface MixedSearchResultCardProps {
  /** 搜索结果项 */
  result: MixedSearchResult;
  /** 视图模式 */
  viewMode: "grid" | "list" | "compact" | string;
  /** 主题 */
  theme: ThemeName;
  /** 是否显示相似度 */
  showSimilarity?: boolean;
}

/**
 * 获取来源类型标签
 */
function getSourceTypeLabel(sourceType: ImageSourceType): string {
  switch (sourceType) {
    case "gallery":
      return "图库";
    case "wiki":
      return "百科";
    case "post":
      return "帖子";
    default:
      return "其他";
  }
}

/**
 * 获取来源类型图标
 */
function getSourceTypeIcon(sourceType: ImageSourceType) {
  switch (sourceType) {
    case "gallery":
      return ImageIcon;
    case "wiki":
      return Book;
    case "post":
      return MessageSquare;
    default:
      return Sparkles;
  }
}

/**
 * 获取来源类型颜色样式
 */
function getSourceTypeStyles(sourceType: ImageSourceType): {
  badge: string;
  icon: string;
  hover: string;
} {
  switch (sourceType) {
    case "gallery":
      return {
        badge: "bg-blue-100 text-blue-700",
        icon: "text-blue-500",
        hover: "hover:border-blue-200 hover:shadow-blue-100/50",
      };
    case "wiki":
      return {
        badge: "bg-brand-cream text-brand-olive",
        icon: "text-brand-olive",
        hover: "hover:border-brand-olive/20",
      };
    case "post":
      return {
        badge: "bg-orange-100 text-orange-700",
        icon: "text-orange-500",
        hover: "hover:border-orange-200 hover:shadow-orange-100/50",
      };
    default:
      return {
        badge: "bg-gray-100 text-gray-700",
        icon: "text-gray-500",
        hover: "hover:border-gray-200",
      };
  }
}

/**
 * 获取跳转链接
 */
function getResultLink(result: MixedSearchResult, theme: ThemeName): string {
  switch (result.sourceType) {
    case "gallery":
      return withThemeSearch(`/gallery/${result.sourceId}`, theme);
    case "wiki":
      return withThemeSearch(`/wiki/${result.sourceId}`, theme);
    case "post":
      return withThemeSearch(`/forum/${result.sourceId}`, theme);
    default:
      return "#";
  }
}

/**
 * 格式化相似度为百分比
 */
function formatSimilarity(similarity: number): string {
  return `${(similarity * 100).toFixed(1)}%`;
}

/**
 * 混合搜索结果卡片组件
 * 根据 sourceType 显示不同的样式和内容
 */
export const MixedSearchResultCard = React.memo(
  ({ result, viewMode, theme, showSimilarity = true }: MixedSearchResultCardProps) => {
    const { sourceType, data, imageUrl, similarity } = result;
    const styles = getSourceTypeStyles(sourceType);
    const SourceIcon = getSourceTypeIcon(sourceType);
    const link = getResultLink(result, theme);

    // 列表视图
    if (viewMode === "list") {
      return (
        <Link
          to={link}
          className={clsx(
            "flex gap-4 p-4 bg-white rounded-xl border border-gray-100 transition-all w-full group",
            styles.hover,
            "hover:shadow-lg"
          )}
        >
          {/* 图片缩略图 */}
          <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
            <SmartImage
              src={imageUrl || ""}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>

          {/* 内容区域 */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              {/* 来源类型标签 */}
              <span
                className={clsx(
                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                  styles.badge
                )}
              >
                <SourceIcon size={10} />
                {getSourceTypeLabel(sourceType)}
              </span>

              {/* 相似度标签 */}
              {showSimilarity && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded flex items-center gap-1">
                  <Sparkles size={10} />
                  {formatSimilarity(similarity)}
                </span>
              )}
            </div>

            {/* 标题 */}
            <h3 className="text-base font-serif font-bold truncate group-hover:text-brand-olive transition-colors">
              {(data as GalleryItem | WikiItem | PostItem).title}
            </h3>

            {/* 描述/分类 */}
            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
              {sourceType === "gallery" && (data as GalleryItem).description}
              {sourceType === "wiki" && (data as WikiItem).category}
              {sourceType === "post" && (data as PostItem).section}
            </p>

            {/* 时间 */}
            <p className="text-[10px] text-gray-300 mt-1 flex items-center gap-1">
              <Clock size={10} />
              {toDateValue((data as GalleryItem | WikiItem | PostItem).updatedAt)
                ? format(
                    toDateValue((data as GalleryItem | WikiItem | PostItem).updatedAt)!,
                    "yyyy-MM-dd"
                  )
                : "刚刚"}
            </p>
          </div>

          {/* 箭头 */}
          <div className="flex items-center">
            <ChevronRight
              size={18}
              className="text-gray-300 group-hover:translate-x-1 transition-transform"
            />
          </div>
        </Link>
      );
    }

    // 紧凑视图
    if (viewMode === "compact") {
      return (
        <Link
          to={link}
          className={clsx(
            "flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 transition-all w-full group",
            styles.hover,
            "hover:shadow-md"
          )}
        >
          {/* 小图 */}
          <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
            <SmartImage
              src={imageUrl || ""}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                  styles.badge
                )}
              >
                {getSourceTypeLabel(sourceType)}
              </span>
              {showSimilarity && (
                <span className="text-[9px] text-purple-600 font-medium">
                  {formatSimilarity(similarity)}
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium truncate mt-0.5">
              {(data as GalleryItem | WikiItem | PostItem).title}
            </h3>
          </div>
        </Link>
      );
    }

    // 网格视图（默认）
    return (
      <Link
        to={link}
        className={clsx(
          "bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all group block",
          styles.hover,
          "hover:shadow-lg"
        )}
      >
        {/* 图片区域 */}
        <div className="h-40 overflow-hidden relative">
          <SmartImage
            src={imageUrl || ""}
            alt=""
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />

          {/* 来源类型标签 - 左上角 */}
          <div className="absolute top-2 left-2">
            <span
              className={clsx(
                "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm",
                styles.badge
              )}
            >
              <SourceIcon size={12} />
              {getSourceTypeLabel(sourceType)}
            </span>
          </div>

          {/* 相似度标签 - 右上角 */}
          {showSimilarity && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm">
                <Sparkles size={10} />
                {formatSimilarity(similarity)}
              </span>
            </div>
          )}
        </div>

        {/* 内容区域 */}
        <div className="p-4">
          {/* 标题 */}
          <h3 className="text-sm font-serif font-bold truncate group-hover:text-brand-olive transition-colors">
            {(data as GalleryItem | WikiItem | PostItem).title}
          </h3>

          {/* 描述/分类 */}
          <p className="text-xs text-gray-400 line-clamp-1 mt-1">
            {sourceType === "gallery" &&
              ((data as GalleryItem).description || "暂无描述")}
            {sourceType === "wiki" && (data as WikiItem).category}
            {sourceType === "post" && (data as PostItem).section}
          </p>

          {/* 底部信息 */}
          <div className="flex items-center justify-between mt-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {toDateValue((data as GalleryItem | WikiItem | PostItem).updatedAt)
                ? format(
                    toDateValue((data as GalleryItem | WikiItem | PostItem).updatedAt)!,
                    "yyyy-MM-dd"
                  )
                : "刚刚"}
            </span>
            <ChevronRight
              size={14}
              className="group-hover:translate-x-1 transition-transform"
            />
          </div>
        </div>
      </Link>
    );
  }
);

MixedSearchResultCard.displayName = "MixedSearchResultCard";

export default MixedSearchResultCard;
