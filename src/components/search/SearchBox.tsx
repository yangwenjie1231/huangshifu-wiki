import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, Camera, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import type { SearchSuggestion } from "../../hooks/useSearch";

interface SearchBoxProps {
  query: string;
  suggestions: SearchSuggestion[];
  aiSearching: boolean;
  onQueryChange: (val: string) => void;
  onSearch: (q: string) => void;
  onImageSearch: (file: File) => void;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  query,
  suggestions,
  aiSearching,
  onQueryChange,
  onSearch,
  onImageSearch,
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImageSearch(file);
    e.target.value = "";
  };

  const getSuggestionTypeLabel = (type: SearchSuggestion["type"]) => {
    switch (type) {
      case "keyword": return "搜索";
      case "wiki": return "百科";
      case "music": return "音乐";
      case "album": return "专辑";
      default: return "帖子";
    }
  };

  const getSuggestionTypeClass = (type: SearchSuggestion["type"]) => {
    switch (type) {
      case "keyword": return "bg-[#f0ece3] text-[#6b6560]";
      case "wiki": return "bg-[#f7f5f0] text-[#c8951e]";
      case "music": return "bg-red-50 text-red-600";
      case "album": return "bg-purple-50 text-purple-600";
      default: return "bg-[#f0ece3] text-[#6b6560]";
    }
  };

  const handleSuggestionClick = (s: SearchSuggestion) => {
    if (s.type === "keyword") {
      onSearch(s.text);
    } else {
      if (s.type === "wiki" && s.id) {
        navigate(`/wiki/${s.id}`);
      } else if (s.type === "post" && s.id) {
        navigate(`/forum/${s.id}`);
      } else if (s.type === "music" && s.id) {
        navigate(`/music/${s.id}`);
      } else if (s.type === "album" && s.id) {
        navigate(`/album/${s.id}`);
      }
    }
  };

  return (
    <div className="bg-white border border-[#e0dcd3] rounded p-6 mb-6">
      <form onSubmit={handleSubmit} className="relative group mb-5">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => query.length >= 2 && onQueryChange(query)}
          placeholder="搜索百科、帖子、图集、音乐或专辑..."
          className="w-full px-12 py-4 bg-[#f7f5f0] border border-[#e0dcd3] rounded focus:outline-none focus:border-[#c8951e] transition-all text-base"
        />
        <SearchIcon
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9e968e] group-focus-within:text-[#c8951e] transition-colors"
          size={20}
        />

        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 right-0 top-full mt-2 bg-white border border-[#e0dcd3] rounded z-50 overflow-hidden"
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#f7f5f0] transition-colors border-b border-[#f0ece3] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-medium", getSuggestionTypeClass(s.type))}>
                      {getSuggestionTypeLabel(s.type)}
                    </span>
                    <span className="text-sm text-[#2c2c2c]">{s.text}</span>
                    {s.subtext && (
                      <span className="text-xs text-[#9e968e]">{s.subtext}</span>
                    )}
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={aiSearching}
            className="p-2.5 bg-[#f7f5f0] text-[#9e968e] rounded hover:text-[#c8951e] hover:bg-[#f7f5f0] transition-all"
            title="AI 图片搜索"
          >
            {aiSearching ? (
              <Sparkles className="animate-spin" size={18} />
            ) : (
              <Camera size={18} />
            )}
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#c8951e] text-white rounded font-medium hover:bg-[#dca828] transition-all"
          >
            搜索
          </button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
      </form>
    </div>
  );
};
