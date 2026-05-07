import React from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import { Book, Image as ImageIcon, Music, MessageSquare, Clock } from "lucide-react";
import { SmartImage } from "../SmartImage";

export type SearchResultType = "wiki" | "gallery" | "music" | "album" | "post";

export interface SearchResultCardConfig {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  link: string;
  image?: string;
  tags?: string[];
  meta?: string;
  type: SearchResultType;
}

interface SearchResultCardProps {
  config: SearchResultCardConfig;
  viewMode: string;
  cardHeight?: string;
}

const typeIconMap: Record<SearchResultType, React.ReactNode> = {
  wiki: <Book size={24} className="text-[#c8951e]/40" />,
  gallery: <ImageIcon size={24} className="text-[#c8951e]/40" />,
  music: <Music size={24} className="text-[#c8951e]/40" />,
  album: <Music size={24} className="text-[#c8951e]/40" />,
  post: <MessageSquare size={24} className="text-[#c8951e]/40" />,
};

export const SearchResultCard: React.FC<SearchResultCardProps> = React.memo(({ config, viewMode, cardHeight }) => {
  const isList = viewMode === "list";

  return (
    <Link
      to={config.link}
      className={clsx(
        "bg-white border border-[#e0dcd3] rounded overflow-hidden hover:border-[#c8951e] transition-all group",
        isList ? "flex gap-4 p-3 w-full" : clsx("flex flex-col block", cardHeight)
      )}
    >
      {isList ? (
        <>
          {config.image ? (
            <div className="w-20 h-20 bg-[#f7f5f0] rounded overflow-hidden flex-shrink-0">
              <SmartImage src={config.image} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-[#f7f5f0] rounded flex items-center justify-center flex-shrink-0">
              {typeIconMap[config.type]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {config.tags && config.tags.length > 0 && (
              <div className="flex items-center gap-2 mb-1">
                {config.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-[#f7f5f0] text-[#c8951e] text-[10px] font-medium rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <h3 className="text-sm font-semibold text-[#2c2c2c] group-hover:text-[#c8951e] transition-colors truncate">
              {config.title}
            </h3>
            {config.description && (
              <p className="text-[#9e968e] text-xs line-clamp-2 italic">{config.description}</p>
            )}
            {config.meta && (
              <p className="text-[#9e968e]/70 text-[10px] mt-1 flex items-center gap-1">
                <Clock size={10} />
                {config.meta}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          {config.image && (
            <div className="overflow-hidden h-48 flex-shrink-0">
              <SmartImage
                src={config.image}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          )}
          <div className={clsx("p-4", !config.image && "flex-1 flex flex-col")}>
            {config.tags && config.tags.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                {config.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-[#f7f5f0] text-[#c8951e] text-[10px] font-medium rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <h3 className="text-sm font-semibold text-[#2c2c2c] mb-2 group-hover:text-[#c8951e] transition-colors truncate">
              {config.title}
            </h3>
            {config.subtitle && (
              <p className="text-xs text-[#9e968e] truncate">{config.subtitle}</p>
            )}
            {config.description && !config.image && (
              <p className="text-[#9e968e] text-xs line-clamp-2 mb-3 italic flex-1">{config.description}</p>
            )}
            {config.meta && (
              <div className="flex items-center gap-1 text-[10px] text-[#9e968e] mt-auto">
                <Clock size={10} />
                {config.meta}
              </div>
            )}
          </div>
        </>
      )}
    </Link>
  );
});

SearchResultCard.displayName = "SearchResultCard";
