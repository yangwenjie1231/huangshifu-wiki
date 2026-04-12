import React from "react";
import { Link } from "react-router-dom";
import type { WikiItem } from "../../types/entities";
import { clsx } from "clsx";
import {
	Book,
	ChevronRight,
	Clock,
	Heart,
	Link2,
	Pin,
	ThumbsDown,
} from "lucide-react";
import { formatDate } from "../../lib/dateUtils";
import { withThemeSearch } from "../../lib/theme";
import { useTheme } from "../../context/ThemeContext";

const getCategoryLabel = (category: string): string => {
	switch (category) {
		case "biography":
			return "人物介绍";
		case "music":
			return "音乐作品";
		case "album":
			return "专辑一览";
		case "timeline":
			return "时间轴";
		case "event":
			return "活动记录";
		default:
			return category;
	}
};

interface WikiCardProps {
	page: WikiItem;
	viewMode: string;
	onCopyLink: (event: React.MouseEvent<HTMLButtonElement>, slug: string) => void;
}

const WikiCard = React.memo(({ page, viewMode, onCopyLink }: WikiCardProps) => {
	const { theme } = useTheme();

	return (
		<div className={clsx("relative group", viewMode === "list" && "flex")}>
			<Link
				to={withThemeSearch(`/wiki/${page.slug}`, theme)}
				className={clsx(
					viewMode === "list"
						? "flex gap-4 p-4 bg-white rounded-xl border hover:border-brand-olive/20 hover:shadow-lg transition-all w-full"
						: "block bg-white p-8 rounded-[32px] border hover:border-brand-olive/20 hover:shadow-xl transition-all",
					page.isPinned && viewMode !== "list"
						? "border-l-4 border-l-brand-olive"
						: "border-gray-100",
					page.isPinned &&
						viewMode === "list" &&
						"border-l-4 border-l-brand-olive",
				)}
			>
				{viewMode === "list" ? (
					<>
						<div className="w-24 h-24 bg-brand-cream/50 rounded-lg flex items-center justify-center flex-shrink-0">
							<Book size={32} className="text-brand-olive/40" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-1">
								{page.isPinned && (
									<span className="flex items-center gap-1 px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded">
										<Pin size={8} /> 已置顶
									</span>
								)}
								<span className="px-2 py-0.5 bg-brand-cream text-brand-olive text-[10px] font-bold uppercase tracking-wider rounded">
									{getCategoryLabel(page.category)}
								</span>
							</div>
							<h3 className="text-lg font-serif font-bold mb-1 group-hover:text-brand-olive transition-colors truncate">
								{page.title}
							</h3>
							<p className="text-gray-400 text-sm line-clamp-2 italic">
								{page.content.replace(/[#*`]/g, "").substring(0, 100)}
							</p>
							<p className="text-gray-300 text-xs mt-1">
								{page.content.replace(/[#*`]/g, "").substring(0, 50)}
								...
							</p>
							<div className="flex items-center gap-3 text-gray-400 text-xs mt-2">
								<span className="flex items-center gap-1">
									<Clock size={10} />{" "}
									{formatDate(page.updatedAt, "yyyy-MM-dd")}
								</span>
								<span className="flex items-center gap-1">
									<Heart size={10} /> {page.likesCount || 0}
								</span>
							</div>
						</div>
					</>
				) : (
					<>
						<div className="flex items-center gap-2 mb-4">
							{page.isPinned && (
								<span className="flex items-center gap-1 px-2 py-1 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded">
									<Pin size={10} /> 已置顶
								</span>
							)}
							<span className="px-2 py-1 bg-brand-cream text-brand-olive text-[10px] font-bold uppercase tracking-wider rounded">
								{getCategoryLabel(page.category)}
							</span>
						</div>
						<h3 className="text-2xl font-serif font-bold mb-4 group-hover:text-brand-olive transition-colors">
							{page.title}
						</h3>
						<p className="text-gray-400 text-sm line-clamp-2 mb-6 italic leading-relaxed">
							{page.content.replace(/[#*`]/g, "").substring(0, 100)}
							...
						</p>
						<div className="flex items-center justify-between text-gray-400 text-xs">
							<div className="flex items-center gap-3">
								<span className="flex items-center gap-1">
									<Clock size={12} />{" "}
									{formatDate(page.updatedAt, "yyyy-MM-dd")}
								</span>
								<span className="flex items-center gap-1">
									<Heart size={12} /> {page.likesCount || 0}
								</span>
								<span className="flex items-center gap-1">
									<ThumbsDown size={12} /> {page.dislikesCount || 0}
								</span>
							</div>
							<ChevronRight
								size={16}
								className="group-hover:translate-x-1 transition-transform"
							/>
						</div>
					</>
				)}
			</Link>
			<button
				onClick={(event) => onCopyLink(event, page.slug)}
				className={clsx(
					"p-2 rounded-full border bg-white/90 text-gray-400 shadow-sm hover:text-brand-olive hover:border-brand-olive/30 transition-all",
					viewMode === "list"
						? "absolute top-4 right-4"
						: "absolute bottom-5 right-5 sm:opacity-0 sm:group-hover:opacity-100",
				)}
				title="复制内链"
				aria-label="复制百科内链"
			>
				<Link2 size={14} />
			</button>
		</div>
	);
});

WikiCard.displayName = "WikiCard";

export default WikiCard;
