import React, {
	useEffect,
	useState,
	useMemo,
} from "react";
import {
	Routes,
	Route,
	Link,
	useParams,
	useSearchParams,
	useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { customSchema, isTrustedIframeDomain } from "../lib/htmlSanitizer";
import {
	Book,
	Edit3,
	Plus,
	ChevronRight,
	Tag,
	Clock,
	User as UserIcon,
	ArrowLeft,
	Save,
	X,
	Sparkles,
	History,
	Calendar,
	Link2,
	GitBranch,
	Network,
	MapPin,
	ThumbsDown,
	ThumbsUp,
	Pin,
} from "lucide-react";
import { useUserPreferences } from "../context/UserPreferencesContext";
import { useTheme } from "../context/ThemeContext";
import { ViewModeSelector } from "../components/ViewModeSelector";
import { VIEW_MODE_CONFIG } from "../lib/viewModes";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";
import { summarizeWikiContent } from "../services/aiService";
import { useToast } from "../components/Toast";
import { copyToClipboard, toAbsoluteInternalUrl } from "../lib/copyLink";
import { apiDelete, apiGet, apiPost } from "../lib/apiClient";
import {
	ContentStatus,
	getStatusText,
	splitTagsInput,
} from "../lib/contentUtils";
import { formatDate } from "../lib/dateUtils";
import { withThemeSearch } from "../lib/theme";
import WikiLinkPreview from "../components/WikiLinkPreview";
import RelationGraph, {
	RelationGraphData,
	WikiRelationType as GraphRelationType,
} from "../components/wiki/RelationGraph";
import Pagination from "../components/Pagination";
import WikiCard from "../components/wiki/WikiCard";
import WikiEditorComponent from "../components/wiki/WikiEditor";
import type {
	WikiItemWithRelations,
	WikiRelationRecord,
} from "../components/wiki/types";
import { RELATION_TYPE_LABELS } from "../components/wiki/types";

const DEFAULT_PAGE_SIZE = 24;

type WikiRelationResolved = WikiRelationRecord & {
	typeLabel: string;
	targetTitle: string;
	targetCategory: string;
	inferred: boolean;
	sourceSlug: string;
	sourceTitle: string;
};

const academyWikiLecturers = [
	{
		name: "馆籍讲师 · 明弦",
		focus: "人物卷",
		desc: "负责人物卷条目整理与出处校验，帮助新读者快速建立阅读顺序。",
	},
	{
		name: "编年讲师 · 微雨",
		focus: "时间轴",
		desc: "维护关键事件时间线，将散落资料归入统一年表。",
	},
];

const academyWikiCopyMappings = [
	{
		field: "分类标签",
		defaultCopy: "人物介绍 / 音乐作品 / 专辑一览",
		academyCopy: "卷目 / 曲目 / 案卷，采用书院编目口径",
	},
	{
		field: "时间轴入口",
		defaultCopy: "时间轴视图",
		academyCopy: "编年卷轴",
	},
];

type WikiItem = WikiItemWithRelations;

type WikiBranchStatus =
	| "draft"
	| "pending_review"
	| "merged"
	| "rejected"
	| "conflict";
type WikiPullRequestStatus = "open" | "merged" | "rejected";

type WikiBranchItem = {
	id: string;
	pageSlug: string;
	editorUid: string;
	editorName: string;
	status: WikiBranchStatus;
	latestRevisionId: string | null;
	createdAt: string;
	updatedAt: string;
	page: {
		slug: string;
		title: string;
		category: string;
	} | null;
};

type WikiRevisionItem = {
	id: string;
	pageSlug: string;
	branchId?: string | null;
	title: string;
	content: string;
	slug?: string | null;
	category?: string | null;
	tags?: string[];
	relations?: unknown[];
	eventDate?: string | null;
	editorUid: string;
	editorName: string;
	isAutoSave: boolean;
	createdAt: string;
};

type WikiPullRequestComment = {
	id: string;
	prId: string;
	authorUid: string;
	authorName: string;
	content: string;
	createdAt: string;
};

type WikiPullRequestItem = {
	id: string;
	branchId: string;
	pageSlug: string;
	title: string;
	description: string | null;
	status: WikiPullRequestStatus;
	createdByUid: string;
	createdByName: string;
	reviewedBy: string | null;
	reviewedAt: string | null;
	mergedAt: string | null;
	baseRevisionId: string | null;
	conflictData: unknown;
	createdAt: string;
	updatedAt: string;
	branch: WikiBranchItem | null;
	page: {
		slug: string;
		title: string;
		category: string;
	} | null;
	comments: WikiPullRequestComment[];
};

type WikiPrDiffResponse = {
	diff: {
		base: {
			title: string;
			content: string;
			category: string;
			tags: string[];
			eventDate: string | null;
		};
		head: {
			title: string;
			content: string;
			category: string;
			tags: string[];
			eventDate: string | null;
		};
	};
};

const getBranchStatusText = (status: WikiBranchStatus) => {
	if (status === "pending_review") return "待审核";
	if (status === "merged") return "已合并";
	if (status === "rejected") return "已驳回";
	if (status === "conflict") return "冲突待处理";
	return "草稿";
};

const getPrStatusText = (status: WikiPullRequestStatus) => {
	if (status === "merged") return "已合并";
	if (status === "rejected") return "已驳回";
	return "进行中";
};

// --- Wiki Internal Linking Component ---
const WikiMarkdown = ({ content }: { content: string }) => {
	const { theme, isAcademy } = useTheme();
	// Pre-process internal links [[display|slug]] or [[slug]] to standard markdown links
	// This is safer than overriding the 'p' component which can break with HTML
	const processedContent = useMemo(() => {
		return content.replace(
			/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
			(match, p1, p2) => {
				const display = p1.trim();
				const slug = p2 ? p2.trim() : p1.trim();
				return `[${display}](${withThemeSearch(`/wiki/${slug}`, theme)})`;
			},
		);
	}, [content, theme]);

	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			rehypePlugins={[rehypeRaw, [rehypeSanitize, customSchema]]}
			components={{
				iframe: ({
					src,
					width,
					height,
					...props
				}: React.IframeHTMLAttributes<HTMLIFrameElement>) => {
					if (!isTrustedIframeDomain(src)) {
						return null;
					}
					return (
						<iframe
							src={src}
							width={width || "100%"}
							height={height || "400px"}
							{...props}
						/>
					);
				},
				a: ({ href, children, ...props }) => {
					if (href?.startsWith("/wiki/")) {
						const rawSlug = href.replace("/wiki/", "");
						const slug = rawSlug.split("?")[0];
						const themedHref = withThemeSearch(href, theme);
						return (
							<WikiLinkPreview slug={slug}>
								<Link
									to={themedHref}
									className="text-brand-olive font-bold hover:underline decoration-brand-olive/30 underline-offset-4"
									{...props}
								>
									{children}
								</Link>
							</WikiLinkPreview>
						);
					}
					return (
						<a
							href={href}
							target="_blank"
							rel="noopener noreferrer"
							className="text-brand-olive hover:underline"
							{...props}
						>
							{children}
						</a>
					);
				},
				// Support tables with Tailwind
				table: ({ children }) => (
					<div className="overflow-x-auto my-8">
						<table className="w-full border-collapse border border-gray-200 rounded-xl overflow-hidden">
							{children}
						</table>
					</div>
				),
				thead: ({ children }) => (
					<thead className="bg-brand-cream/50 text-brand-olive">
						{children}
					</thead>
				),
				th: ({ children }) => (
					<th className="border border-gray-200 px-4 py-3 text-left font-bold">
						{children}
					</th>
				),
				td: ({ children }) => (
					<td className="border border-gray-200 px-4 py-3">{children}</td>
				),
				tr: ({ children }) => (
					<tr className="hover:bg-gray-50 transition-colors">{children}</tr>
				),
			}}
		>
			{processedContent}
		</ReactMarkdown>
	);
};

// --- Wiki List Component ---
const WikiList = () => {
	const [searchParams] = useSearchParams();
	const category = searchParams.get("category") || "all";
	const tag = searchParams.get("tag");
	const { theme, isAcademy } = useTheme();
	const [pages, setPages] = useState<WikiItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const { user, isBanned } = useAuth();
	const { show } = useToast();
	const { preferences, setViewMode } = useUserPreferences();
	const viewMode = preferences.viewMode;

	const totalWikiPages = Math.ceil(pages.length / pageSize);
	const paginatedPages = useMemo(() => {
		const start = (page - 1) * pageSize;
		return pages.slice(start, start + pageSize);
	}, [pages, page, pageSize]);

	const handlePageChange = (newPage: number) => {
		setPage(newPage);
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const handlePageSizeChange = (newSize: number) => {
		setPageSize(newSize);
		setPage(1);
	};

	useEffect(() => {
		setPage(1);
	}, [category, tag]);

	useEffect(() => {
		const fetchPages = async () => {
			setLoading(true);
			try {
				const data = await apiGet<{ pages: WikiItem[] }>("/api/wiki", {
					category: category !== "all" ? category : undefined,
					tag: tag || undefined,
				});
				setPages(data.pages || []);
			} catch (e) {
				console.error("Error fetching wiki pages:", e);
			}
			setLoading(false);
		};
		fetchPages();
	}, [category, tag]);

	const handleCopyWikiLink = async (
		event: React.MouseEvent<HTMLButtonElement>,
		slug: string,
	) => {
		event.preventDefault();
		event.stopPropagation();
		const copied = await copyToClipboard(
			toAbsoluteInternalUrl(`/wiki/${slug}`),
		);
		if (copied) {
			show("百科内链已复制");
			return;
		}
		show("复制链接失败，请稍后重试", { variant: "error" });
	};

	return (
		<div className="max-w-7xl mx-auto px-4 py-12">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
				<div>
					<h1 className="text-5xl font-serif font-bold text-brand-olive mb-2">
						百科全书
					</h1>
					<p className="text-gray-500 italic">诗扶百科 · 记录每一个动人瞬间</p>
				</div>
				<div className="flex items-center gap-4">
					<ViewModeSelector value={viewMode} onChange={setViewMode} />
					<Link
						to={withThemeSearch("/wiki/timeline", theme)}
						className="px-6 py-3 bg-brand-cream text-brand-olive rounded-full font-medium hover:bg-brand-olive hover:text-white transition-all flex items-center gap-2 shadow-sm"
					>
						<Calendar size={18} />
						<span className="hidden sm:inline">时间轴视图</span>
					</Link>
					{user && !isBanned && !isAcademy && (
						<Link
							to={withThemeSearch("/wiki/new", theme)}
							className="px-6 py-3 bg-brand-olive text-white rounded-full font-medium hover:bg-brand-olive/90 transition-all flex items-center gap-2 shadow-md"
						>
							<Plus size={18} /> 创建页面
						</Link>
					)}
				</div>
			</div>

			<div className="flex flex-wrap gap-2 mb-12">
				{["all", "biography", "music", "album", "timeline", "event"].map(
					(cat) => (
						<Link
							key={cat}
							to={withThemeSearch(`/wiki?category=${cat}`, theme)}
							className={clsx(
								"px-6 py-2 rounded-full text-sm font-medium transition-all border capitalize",
								category === cat
									? "bg-brand-olive text-white border-brand-olive"
									: "bg-white text-gray-500 border-gray-200 hover:border-brand-olive hover:text-brand-olive",
							)}
						>
							{cat === "all"
								? "全部"
								: cat === "biography"
									? "人物介绍"
									: cat === "music"
										? "音乐作品"
										: cat === "album"
											? "专辑一览"
											: cat === "timeline"
												? "时间轴"
												: cat === "event"
													? "活动记录"
													: cat}
						</Link>
					),
				)}
			</div>

			{isAcademy && (
				<section className="theme-surface theme-card p-6 mb-10 space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{academyWikiLecturers.map((lecturer) => (
							<article
								key={lecturer.name}
								className="academy-lecturer-card rounded-xl p-5"
							>
								<p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-theme-muted)] mb-2">
									{lecturer.focus}
								</p>
								<h3 className="text-lg font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
									{lecturer.name}
								</h3>
								<p className="text-sm text-[color:var(--color-theme-text)]/90 leading-relaxed">
									{lecturer.desc}
								</p>
							</article>
						))}
					</div>
					<div className="overflow-x-auto">
						<table className="academy-mapping-table w-full border-collapse rounded-lg overflow-hidden text-sm">
							<thead>
								<tr>
									<th className="border px-3 py-2 text-left">映射项</th>
									<th className="border px-3 py-2 text-left">默认</th>
									<th className="border px-3 py-2 text-left">书院</th>
								</tr>
							</thead>
							<tbody>
								{academyWikiCopyMappings.map((row) => (
									<tr key={row.field}>
										<td className="border px-3 py-2 font-medium">
											{row.field}
										</td>
										<td className="border px-3 py-2 text-[color:var(--color-theme-muted)]">
											{row.defaultCopy}
										</td>
										<td className="border px-3 py-2">{row.academyCopy}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			)}

			{loading ? (
				<div
					className={clsx(
						"grid",
						VIEW_MODE_CONFIG[viewMode].gridCols,
						VIEW_MODE_CONFIG[viewMode].gap,
					)}
				>
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div
							key={i}
							className={clsx(
								viewMode === "list"
									? "h-24"
									: VIEW_MODE_CONFIG[viewMode].cardHeight,
								"bg-white rounded-[32px] animate-pulse border border-gray-100",
							)}
						></div>
					))}
				</div>
			) : pages.length > 0 ? (
				<>
					<div
						className={clsx(
							"grid",
							VIEW_MODE_CONFIG[viewMode].gridCols,
							VIEW_MODE_CONFIG[viewMode].gap,
						)}
					>
						{paginatedPages.map((page) => (
							<WikiCard
								key={page.id}
								page={page}
								viewMode={viewMode}
								onCopyLink={handleCopyWikiLink}
							/>
						))}
					</div>
					{totalWikiPages > 1 && (
						<Pagination
							page={page}
							totalPages={totalWikiPages}
							onPageChange={handlePageChange}
							pageSize={pageSize}
							onPageSizeChange={handlePageSizeChange}
							showPageSizeSelector
						/>
					)}
				</>
			) : (
				<div className="bg-white p-20 rounded-[40px] border border-gray-100 text-center">
					<Book size={48} className="mx-auto text-gray-200 mb-6" />
					<p className="text-gray-400 italic">暂无相关百科页面</p>
				</div>
			)}
		</div>
	);
};

// --- Wiki Page Component ---
const WikiPageView = () => {
	const { slug } = useParams();
	const navigate = useNavigate();
	const { theme, isAcademy } = useTheme();
	const [page, setPage] = useState<WikiItem | null>(null);
	const [loading, setLoading] = useState(true);
	const { user, isAdmin, isBanned } = useAuth();
	const { show } = useToast();
	const [summary, setSummary] = useState<string | null>(null);
	const [summarizing, setSummarizing] = useState(false);
	const [backlinks, setBacklinks] = useState<WikiItem[]>([]);
	const [submittingReview, setSubmittingReview] = useState(false);
	const [favoriting, setFavoriting] = useState(false);
	const [liking, setLiking] = useState(false);
	const [disliking, setDisliking] = useState(false);
	const [pinning, setPinning] = useState(false);
	const [relationGraph, setRelationGraph] = useState<RelationGraphData | null>(
		null,
	);
	const [showGraph, setShowGraph] = useState(false);

	useEffect(() => {
		const fetchPage = async () => {
			setLoading(true);
			try {
				const data = await apiGet<{
					page: WikiItem;
					backlinks: WikiItem[];
					relations: WikiRelationResolved[];
					relationGraph: RelationGraphData;
				}>(`/api/wiki/${slug}`);
				setPage(data.page);
				setBacklinks(data.backlinks || []);
				setRelationGraph(data.relationGraph || null);
			} catch (e) {
				console.error("Error fetching page:", e);
			}
			setLoading(false);
		};
		fetchPage();
	}, [slug]);

	if (loading)
		return (
			<div className="max-w-4xl mx-auto px-4 py-20 text-center italic text-gray-400">
				加载中...
			</div>
		);
	if (!page)
		return (
			<div className="max-w-4xl mx-auto px-4 py-20 text-center italic text-gray-400">
				页面未找到
			</div>
		);

	const isOwner = Boolean(user && page?.lastEditorUid === user.uid);
	const canSubmitReview = Boolean(
		!isBanned &&
			isOwner &&
			page &&
			(page.status === "draft" || page.status === "rejected"),
	);

	const handleCopyPageLink = async () => {
		if (!slug) return;
		const copied = await copyToClipboard(
			toAbsoluteInternalUrl(`/wiki/${slug}`),
		);
		if (copied) {
			show("百科内链已复制");
			return;
		}
		show("复制链接失败，请稍后重试", { variant: "error" });
	};

	const handleToggleLike = async () => {
		if (!slug || !user || liking) return;
		setLiking(true);
		try {
			if (page.likedByMe) {
				await apiDelete<{ liked: boolean; likesCount: number }>(
					`/api/wiki/${slug}/like`,
				);
				setPage((prev) =>
					prev
						? {
								...prev,
								likedByMe: false,
								likesCount: Math.max(0, Number(prev.likesCount || 0) - 1),
							}
						: prev,
				);
			} else {
				const data = await apiPost<{ liked: boolean; likesCount: number }>(
					`/api/wiki/${slug}/like`,
				);
				setPage((prev) =>
					prev
						? {
								...prev,
								likedByMe: data.liked,
								likesCount: data.likesCount,
								dislikedByMe: false,
							}
						: prev,
				);
			}
		} catch (error) {
			console.error("Toggle wiki like failed:", error);
			show("点赞操作失败，请稍后重试", { variant: "error" });
		} finally {
			setLiking(false);
		}
	};

	const handleToggleDislike = async () => {
		if (!slug || !user || disliking) return;
		setDisliking(true);
		try {
			if (page.dislikedByMe) {
				await apiDelete<{ disliked: boolean; dislikesCount: number }>(
					`/api/wiki/${slug}/dislike`,
				);
				setPage((prev) =>
					prev
						? {
								...prev,
								dislikedByMe: false,
								dislikesCount: Math.max(0, Number(prev.dislikesCount || 0) - 1),
							}
						: prev,
				);
			} else {
				const data = await apiPost<{
					disliked: boolean;
					dislikesCount: number;
				}>(`/api/wiki/${slug}/dislike`);
				setPage((prev) =>
					prev
						? {
								...prev,
								dislikedByMe: data.disliked,
								dislikesCount: data.dislikesCount,
								likedByMe: false,
							}
						: prev,
				);
			}
		} catch (error) {
			console.error("Toggle wiki dislike failed:", error);
			show("踩操作失败，请稍后重试", { variant: "error" });
		} finally {
			setDisliking(false);
		}
	};

	const handleTogglePin = async () => {
		if (!slug || !isAdmin || pinning) return;
		setPinning(true);
		try {
			if (page.isPinned) {
				await apiDelete<{ isPinned: boolean }>(`/api/wiki/${slug}/pin`);
				setPage((prev) => (prev ? { ...prev, isPinned: false } : prev));
			} else {
				const data = await apiPost<{ isPinned: boolean }>(
					`/api/wiki/${slug}/pin`,
				);
				setPage((prev) => (prev ? { ...prev, isPinned: data.isPinned } : prev));
			}
		} catch (error) {
			console.error("Toggle wiki pin failed:", error);
			show("置顶操作失败，请稍后重试", { variant: "error" });
		} finally {
			setPinning(false);
		}
	};

	const handleToggleFavorite = async () => {
		if (!slug || !user || favoriting) return;
		setFavoriting(true);
		try {
			if (page.favoritedByMe) {
				await apiDelete(`/api/favorites/wiki/${slug}`);
				setPage((prev) =>
					prev
						? {
								...prev,
								favoritedByMe: false,
								favoritesCount: Math.max(
									0,
									Number(prev.favoritesCount || 0) - 1,
								),
							}
						: prev,
				);
			} else {
				await apiPost("/api/favorites", { targetType: "wiki", targetId: slug });
				setPage((prev) =>
					prev
						? {
								...prev,
								favoritedByMe: true,
								favoritesCount: Number(prev.favoritesCount || 0) + 1,
							}
						: prev,
				);
			}
		} catch (error) {
			console.error("Toggle wiki favorite failed:", error);
			show("收藏操作失败，请稍后重试", { variant: "error" });
		} finally {
			setFavoriting(false);
		}
	};

	const handleSubmitReview = async () => {
		if (!slug || !canSubmitReview || submittingReview) return;
		setSubmittingReview(true);
		try {
			const data = await apiPost<{ page: WikiItem }>(
				`/api/wiki/${slug}/submit`,
			);
			setPage((prev) => (prev ? { ...prev, ...data.page } : prev));
			show("已提交审核，请等待管理员处理");
		} catch (error) {
			console.error("Submit wiki review failed:", error);
			show("提交审核失败，请稍后重试", { variant: "error" });
		} finally {
			setSubmittingReview(false);
		}
	};

	return (
		<div className="max-w-4xl mx-auto px-4 py-12">
			<Link
				to={withThemeSearch("/wiki", theme)}
				className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive mb-8 transition-colors"
			>
				<ArrowLeft size={18} /> 返回百科列表
			</Link>

			<article className="bg-white rounded-[40px] p-8 sm:p-16 border border-gray-100 shadow-sm">
				<header className="mb-12 border-b border-gray-100 pb-12">
					<div className="flex items-center gap-3 mb-6">
						<span className="px-3 py-1 bg-brand-cream text-brand-olive text-xs font-bold uppercase tracking-widest rounded-full">
							{page.category === "biography"
								? "人物介绍"
								: page.category === "music"
									? "音乐作品"
									: page.category === "album"
										? "专辑一览"
										: page.category === "timeline"
											? "时间轴"
											: page.category === "event"
												? "活动记录"
												: page.category}
						</span>
						<span className="text-gray-300">/</span>
						<span className="text-gray-400 text-sm flex items-center gap-1">
							<Clock size={14} /> 最后更新:{" "}
							{formatDate(page.updatedAt, "yyyy-MM-dd HH:mm")}
						</span>
					</div>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<h1 className="min-w-0 flex-1 text-5xl sm:text-6xl font-serif font-bold text-brand-olive leading-tight">
							{page.title}
						</h1>
						<div className="flex flex-wrap items-center gap-2 sm:justify-end">
							<button
								onClick={handleToggleFavorite}
								disabled={!user || favoriting}
								className={clsx(
									"p-3 rounded-full transition-all flex items-center gap-2",
									page.favoritedByMe
										? "bg-brand-olive text-white"
										: "bg-brand-cream text-brand-olive hover:bg-brand-olive hover:text-white",
									(!user || favoriting) && "opacity-50 cursor-not-allowed",
								)}
								title={page.favoritedByMe ? "取消收藏" : "收藏页面"}
							>
								<Save size={20} />
							</button>
							<button
								onClick={handleToggleLike}
								disabled={!user || liking}
								className={clsx(
									"p-3 rounded-full transition-all flex items-center gap-2",
									page.likedByMe
										? "bg-red-500 text-white"
										: "bg-brand-cream text-brand-olive hover:bg-red-500 hover:text-white",
									(!user || liking) && "opacity-50 cursor-not-allowed",
								)}
								title={page.likedByMe ? "取消点赞" : "点赞"}
							>
								<ThumbsUp size={20} />
							</button>
							<button
								onClick={handleToggleDislike}
								disabled={!user || disliking}
								className={clsx(
									"p-3 rounded-full transition-all flex items-center gap-2",
									page.dislikedByMe
										? "bg-orange-500 text-white"
										: "bg-brand-cream text-brand-olive hover:bg-orange-500 hover:text-white",
									(!user || disliking) && "opacity-50 cursor-not-allowed",
								)}
								title={page.dislikedByMe ? "取消踩" : "踩"}
							>
								<ThumbsDown size={20} />
							</button>
							<button
								onClick={handleTogglePin}
								disabled={!isAdmin || pinning}
								className={clsx(
									"p-3 rounded-full transition-all flex items-center gap-2",
									page.isPinned
										? "bg-brand-primary text-gray-900"
										: "bg-brand-cream text-brand-olive hover:bg-brand-primary hover:text-gray-900",
									(!isAdmin || pinning) && "opacity-50 cursor-not-allowed",
								)}
								title={page.isPinned ? "取消置顶" : "置顶"}
							>
								<Pin size={20} />
							</button>
							<button
								onClick={handleCopyPageLink}
								className="p-3 bg-brand-cream text-brand-olive rounded-full hover:bg-brand-olive hover:text-white transition-all"
								title="复制内链"
								aria-label="复制百科内链"
							>
								<Link2 size={20} />
							</button>
							<button
								onClick={() => setShowGraph(!showGraph)}
								className={clsx(
									"p-3 rounded-full transition-all flex items-center gap-2",
									showGraph
										? "bg-brand-olive text-white"
										: "bg-brand-cream text-brand-olive hover:bg-brand-olive hover:text-white",
								)}
								title="知识图谱"
							>
								<Network size={20} />
							</button>
							<button
								onClick={async () => {
									setSummarizing(true);
									const s = await summarizeWikiContent(page.content);
									setSummary(s);
									setSummarizing(false);
								}}
								disabled={summarizing}
								className="p-3 bg-brand-cream text-brand-olive rounded-full hover:bg-brand-olive hover:text-white transition-all flex items-center gap-2"
								title="AI 摘要"
							>
								<Sparkles size={20} />
								{summarizing && <span className="text-xs">生成中...</span>}
							</button>
							{user && !isBanned && !isAcademy && (
								<Link
									to={withThemeSearch(`/wiki/${slug}/branches`, theme)}
									className="p-3 bg-brand-cream text-brand-olive rounded-full hover:bg-brand-olive hover:text-white transition-all"
									title="协作分支"
								>
									<GitBranch size={20} />
								</Link>
							)}
							{isOwner && !isAcademy && (
								<div className="flex gap-2">
									{(page.category !== "music" || isAdmin) && (
										<>
											<Link
												to={withThemeSearch(`/wiki/${slug}/history`, theme)}
												className="p-3 bg-brand-cream text-brand-olive rounded-full hover:bg-brand-olive hover:text-white transition-all"
												title="历史版本"
											>
												<History size={20} />
											</Link>
											<Link
												to={withThemeSearch(`/wiki/${slug}/edit`, theme)}
												className="p-3 bg-brand-cream text-brand-olive rounded-full hover:bg-brand-olive hover:text-white transition-all"
											>
												<Edit3 size={20} />
											</Link>
										</>
									)}
								</div>
							)}
						</div>
					</div>
					<div className="mt-4 flex flex-wrap items-center gap-3">
						<span
							className={clsx(
								"px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
								page.status === "published"
									? "bg-green-100 text-green-700"
									: page.status === "pending"
										? "bg-amber-100 text-amber-700"
										: page.status === "rejected"
											? "bg-red-100 text-red-700"
											: "bg-gray-100 text-gray-600",
							)}
						>
							{getStatusText(page.status)}
						</span>
						<span className="text-xs text-gray-500">
							收藏 {page.favoritesCount || 0}
						</span>
						<span className="text-xs text-gray-500">
							点赞 {page.likesCount || 0}
						</span>
						<span className="text-xs text-gray-500">
							踩 {page.dislikesCount || 0}
						</span>
						{page.isPinned && (
							<span className="text-xs text-brand-olive font-bold">已置顶</span>
						)}
						{canSubmitReview && (
							<button
								onClick={handleSubmitReview}
								disabled={submittingReview}
								className="px-4 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold hover:bg-amber-200 disabled:opacity-50"
							>
								{submittingReview ? "提交中..." : "提交审核"}
							</button>
						)}
						{page.status === "rejected" && page.reviewNote ? (
							<span className="text-xs text-red-500">
								驳回原因：{page.reviewNote}
							</span>
						) : null}
					</div>
				</header>

				{summary && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						className="mb-12 p-8 bg-brand-olive/5 border border-brand-olive/10 rounded-3xl relative overflow-hidden"
					>
						<div className="absolute top-0 left-0 w-1 h-full bg-brand-olive"></div>
						<h4 className="text-sm font-bold text-brand-olive uppercase tracking-widest mb-3 flex items-center gap-2">
							<Sparkles size={14} /> AI 摘要
						</h4>
						<p className="text-gray-600 italic leading-relaxed">{summary}</p>
						<button
							onClick={() => setSummary(null)}
							className="absolute top-4 right-4 text-gray-400 hover:text-brand-olive"
						>
							<X size={16} />
						</button>
					</motion.div>
				)}

				<div className="prose prose-lg prose-stone max-w-none font-body leading-relaxed text-gray-700">
					<WikiMarkdown content={page.content} />
				</div>

				{backlinks.length > 0 && (
					<div className="mt-20 pt-12 border-t border-gray-100">
						<h4 className="text-sm font-bold text-brand-olive uppercase tracking-widest mb-6 flex items-center gap-2">
							<ChevronRight size={14} /> 引用本页的内容
						</h4>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							{backlinks.map((link) => (
								<Link
									key={link.id}
									to={withThemeSearch(`/wiki/${link.slug}`, theme)}
									className="p-4 bg-brand-cream/30 border border-brand-cream rounded-2xl hover:bg-brand-cream transition-all group"
								>
									<p className="font-bold text-brand-olive group-hover:underline underline-offset-4">
										{link.title}
									</p>
									<p className="text-xs text-gray-400 mt-1 truncate">
										{link.slug}
									</p>
								</Link>
							))}
						</div>
					</div>
				)}

				{showGraph && relationGraph && (
					<div className="mt-16">
						<div className="flex items-center justify-between mb-6">
							<h4 className="text-sm font-bold text-brand-olive uppercase tracking-widest flex items-center gap-2">
								<Network size={14} /> 知识图谱
							</h4>
							<span className="text-xs text-gray-400">点击节点可跳转页面</span>
						</div>
						<RelationGraph
							graph={relationGraph}
							currentSlug={slug || ""}
							onNodeClick={(nodeSlug) =>
								navigate(withThemeSearch(`/wiki/${nodeSlug}`, theme))
							}
						/>
					</div>
				)}

				{page.relations && page.relations.length > 0 && !showGraph && (
					<div className="mt-20 pt-12 border-t border-gray-100">
						<h4 className="text-sm font-bold text-brand-olive uppercase tracking-widest mb-6 flex items-center gap-2">
							<Book size={14} /> 相关页面
						</h4>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							{page.relations.map(
								(relation: WikiRelationRecord, index: number) => (
									<Link
										key={`${relation.targetSlug}-${index}`}
										to={withThemeSearch(`/wiki/${relation.targetSlug}`, theme)}
										className="p-4 bg-brand-primary/5 border border-brand-primary/10 rounded-2xl hover:bg-brand-primary/10 transition-all group"
									>
										<p className="text-xs text-brand-primary font-bold uppercase tracking-wider mb-1">
											{RELATION_TYPE_LABELS[relation.type] || relation.type}
										</p>
										<p className="font-bold text-brand-olive group-hover:underline underline-offset-4">
											{relation.label || relation.targetSlug}
										</p>
										{relation.bidirectional && (
											<span className="inline-block mt-1 text-[10px] text-gray-400">
												↔ 双向关联
											</span>
										)}
									</Link>
								),
							)}
						</div>
					</div>
				)}

				<footer className="mt-20 pt-12 border-t border-gray-100 flex flex-wrap gap-4 items-center justify-between">
					<div className="flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-2 text-gray-400 text-sm italic">
							<Tag size={14} />
							{page.tags?.map((tag: string) => (
								<span
									key={tag}
									onClick={() =>
										navigate(
											withThemeSearch(
												`/wiki?tag=${encodeURIComponent(tag)}`,
												theme,
											),
										)
									}
									className="hover:text-brand-olive cursor-pointer px-2 py-0.5 bg-brand-cream/30 rounded-full text-[10px] font-bold uppercase tracking-wider"
								>
									#{tag}
								</span>
							))}
						</div>
						{page.locationName && (
							<div className="flex items-center gap-2 text-gray-400 text-sm">
								<MapPin size={14} className="text-amber-500" />
								<span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
									{page.locationName}
								</span>
							</div>
						)}
					</div>
					<div className="flex items-center gap-2 text-gray-400 text-sm">
						<UserIcon size={14} /> 编辑者:{" "}
						<span className="font-bold text-brand-olive">
							{page.lastEditorName || "匿名用户"}
						</span>{" "}
						<span className="text-[10px] opacity-50">
							({page.lastEditorUid?.substring(0, 8)})
						</span>
					</div>
				</footer>
			</article>
		</div>
	);
};

// --- Wiki Editor Component ---
const WikiBranchWorkspace = () => {
	const { slug } = useParams();
	const navigate = useNavigate();
	const { theme } = useTheme();
	const { user, isAdmin, isBanned } = useAuth();

	const [page, setPage] = useState<WikiItem | null>(null);
	const [branch, setBranch] = useState<WikiBranchItem | null>(null);
	const [revisions, setRevisions] = useState<WikiRevisionItem[]>([]);
	const [openPr, setOpenPr] = useState<WikiPullRequestItem | null>(null);

	const [loading, setLoading] = useState(true);
	const [creatingBranch, setCreatingBranch] = useState(false);
	const [savingRevision, setSavingRevision] = useState(false);
	const [creatingPr, setCreatingPr] = useState(false);
	const [resolvingConflict, setResolvingConflict] = useState(false);
	const { show } = useToast();

	const [title, setTitle] = useState("");
	const [category, setCategory] = useState("biography");
	const [eventDate, setEventDate] = useState("");
	const [tags, setTags] = useState("");
	const [content, setContent] = useState("");
	const [prTitle, setPrTitle] = useState("");
	const [prDescription, setPrDescription] = useState("");

	const hydrateFromRevision = (
		revision: WikiRevisionItem | null,
		fallbackPage: WikiItem | null,
	) => {
		if (revision) {
			setTitle(revision.title || "");
			setCategory(revision.category || fallbackPage?.category || "biography");
			setEventDate(revision.eventDate || "");
			setTags((revision.tags || []).join(", "));
			setContent(revision.content || "");
			return;
		}
		if (fallbackPage) {
			setTitle(fallbackPage.title || "");
			setCategory(fallbackPage.category || "biography");
			setEventDate(fallbackPage.eventDate || "");
			setTags((fallbackPage.tags || []).join(", "));
			setContent(fallbackPage.content || "");
		}
	};

	const fetchWorkspace = async () => {
		if (!slug || !user) return;
		setLoading(true);
		try {
			const pageData = await apiGet<{ page: WikiItem }>(`/api/wiki/${slug}`);
			const currentPage = pageData.page;
			setPage(currentPage);

			const branchList = await apiGet<{ branches: WikiBranchItem[] }>(
				`/api/wiki/${slug}/branches`,
			);
			const mine =
				(branchList.branches || []).find(
					(item) => item.editorUid === user.uid,
				) || null;
			setBranch(mine);

			if (!mine) {
				setOpenPr(null);
				setRevisions([]);
				hydrateFromRevision(null, currentPage);
				setPrTitle(currentPage.title || "");
				setPrDescription("");
				return;
			}

			const [branchDetail, revisionsData, prsOpen] = await Promise.all([
				apiGet<{
					branch: WikiBranchItem;
					latestRevision: WikiRevisionItem | null;
				}>(`/api/wiki/branches/${mine.id}`),
				apiGet<{ revisions: WikiRevisionItem[] }>(
					`/api/wiki/branches/${mine.id}/revisions`,
				),
				apiGet<{ pullRequests: WikiPullRequestItem[] }>(
					"/api/wiki/pull-requests/list",
					{ status: "open" },
				),
			]);

			setBranch(branchDetail.branch);
			setRevisions(revisionsData.revisions || []);
			hydrateFromRevision(branchDetail.latestRevision, currentPage);

			const currentOpenPr =
				(prsOpen.pullRequests || []).find(
					(item) => item.branchId === mine.id,
				) || null;
			setOpenPr(currentOpenPr);
			setPrTitle(currentOpenPr?.title || currentPage.title || "");
			setPrDescription(currentOpenPr?.description || "");
		} catch (error) {
			console.error("Fetch wiki branch workspace error:", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchWorkspace();
	}, [slug, user?.uid]);

	const handleCreateBranch = async () => {
		if (!slug || !user || isBanned || creatingBranch) return;
		try {
			setCreatingBranch(true);
			await apiPost<{ branch: WikiBranchItem }>(`/api/wiki/${slug}/branches`);
			await fetchWorkspace();
		} catch (error) {
			console.error("Create branch error:", error);
			show("创建分支失败，请稍后重试", { variant: "error" });
		} finally {
			setCreatingBranch(false);
		}
	};

	const handleSaveRevision = async () => {
		if (!branch || isBanned || savingRevision) return;
		if (!title.trim() || !content.trim() || !category.trim()) {
			show("请先填写标题、分类和内容", { variant: "error" });
			return;
		}
		try {
			setSavingRevision(true);
			await apiPost(`/api/wiki/branches/${branch.id}/revisions`, {
				title: title.trim(),
				content,
				category,
				eventDate: eventDate || null,
				tags: splitTagsInput(tags),
			});
			await fetchWorkspace();
		} catch (error) {
			console.error("Save branch revision error:", error);
			show("保存分支失败，请稍后重试", { variant: "error" });
		} finally {
			setSavingRevision(false);
		}
	};

	const handleCreatePr = async () => {
		if (!branch || creatingPr || openPr || isBanned) return;
		if (!prTitle.trim()) {
			show("请填写 PR 标题", { variant: "error" });
			return;
		}
		try {
			setCreatingPr(true);
			await apiPost(`/api/wiki/branches/${branch.id}/pull-request`, {
				title: prTitle.trim(),
				description: prDescription.trim() || null,
			});
			await fetchWorkspace();
		} catch (error) {
			console.error("Create wiki PR error:", error);
			show("提交 PR 失败，请稍后重试", { variant: "error" });
		} finally {
			setCreatingPr(false);
		}
	};

	const handleResolveConflict = async () => {
		if (
			!branch ||
			branch.status !== "conflict" ||
			resolvingConflict ||
			isBanned
		)
			return;
		if (!title.trim() || !content.trim() || !category.trim()) {
			show("请先填写标题、分类和内容", { variant: "error" });
			return;
		}
		try {
			setResolvingConflict(true);
			await apiPost(`/api/wiki/branches/${branch.id}/resolve-conflict`, {
				title: title.trim(),
				content,
				category,
				eventDate: eventDate || null,
				tags: splitTagsInput(tags),
			});
			await fetchWorkspace();
		} catch (error) {
			console.error("Resolve wiki conflict error:", error);
			show("解决冲突失败，请稍后重试", { variant: "error" });
		} finally {
			setResolvingConflict(false);
		}
	};

	if (!user) {
		return (
			<div className="max-w-4xl mx-auto px-4 py-20 text-center">
				<p className="text-gray-400 italic">请先登录后再使用协作分支。</p>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="max-w-4xl mx-auto px-4 py-20 text-center italic text-gray-400">
				加载分支中...
			</div>
		);
	}

	if (!page) {
		return (
			<div className="max-w-4xl mx-auto px-4 py-20 text-center italic text-gray-400">
				页面不存在或不可访问
			</div>
		);
	}

	return (
		<div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Link
					to={withThemeSearch(`/wiki/${slug}`, theme)}
					className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive transition-colors"
				>
					<ArrowLeft size={18} /> 返回百科页面
				</Link>
				<div className="flex gap-2">
					<Link
						to={withThemeSearch(`/wiki/${slug}/prs`, theme)}
						className="px-4 py-2 rounded-full border border-gray-200 text-xs font-bold text-gray-600 hover:border-brand-olive/40 hover:text-brand-olive"
					>
						查看 PR 列表
					</Link>
					{isAdmin && (
						<button
							onClick={fetchWorkspace}
							className="px-4 py-2 rounded-full border border-gray-200 text-xs font-bold text-gray-600 hover:border-brand-olive/40 hover:text-brand-olive"
						>
							刷新
						</button>
					)}
				</div>
			</div>

			<div className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8">
				<h1 className="text-3xl font-serif font-bold text-brand-olive mb-2">
					协作分支：{page.title}
				</h1>
				<p className="text-gray-500 text-sm">
					在这里编辑你的分支版本，提交 PR 后由管理员审核合并。
				</p>

				{branch ? (
					<div className="mt-4 flex flex-wrap items-center gap-2">
						<span
							className={clsx(
								"px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
								branch.status === "pending_review"
									? "bg-amber-100 text-amber-700"
									: branch.status === "conflict"
										? "bg-red-100 text-red-700"
										: branch.status === "merged"
											? "bg-green-100 text-green-700"
											: "bg-gray-100 text-gray-600",
							)}
						>
							{getBranchStatusText(branch.status)}
						</span>
						<span className="text-xs text-gray-500">
							分支人：{branch.editorName}
						</span>
						<span className="text-xs text-gray-400">
							最近更新：{formatDate(branch.updatedAt, "yyyy-MM-dd HH:mm")}
						</span>
					</div>
				) : (
					<div className="mt-5">
						<button
							onClick={handleCreateBranch}
							disabled={creatingBranch || isBanned}
							className="px-5 py-2 rounded-full bg-brand-olive text-white text-sm font-bold disabled:opacity-50"
						>
							{creatingBranch ? "创建中..." : "创建我的分支"}
						</button>
					</div>
				)}
			</div>

			{branch && (
				<>
					<div className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8 space-y-5">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
									标题 <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									value={title}
									onChange={(event) => setTitle(event.target.value)}
									className="w-full mt-1 px-4 py-3 rounded-xl bg-brand-cream border-none focus:ring-2 focus:ring-brand-olive/20"
								/>
							</div>
							<div>
								<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
									分类 <span className="text-red-500">*</span>
								</label>
								<select
									value={category}
									onChange={(event) => setCategory(event.target.value)}
									className="w-full mt-1 px-4 py-3 rounded-xl bg-brand-cream border-none focus:ring-2 focus:ring-brand-olive/20"
								>
									<option value="biography">人物介绍</option>
									<option value="music">音乐作品</option>
									<option value="album">专辑一览</option>
									<option value="timeline">时间轴</option>
									<option value="event">活动记录</option>
								</select>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
									事件日期
								</label>
								<input
									type="date"
									value={eventDate}
									onChange={(event) => setEventDate(event.target.value)}
									className="w-full mt-1 px-4 py-3 rounded-xl bg-brand-cream border-none focus:ring-2 focus:ring-brand-olive/20"
								/>
							</div>
							<div>
								<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
									标签 (逗号分隔)
								</label>
								<input
									type="text"
									value={tags}
									onChange={(event) => setTags(event.target.value)}
									className="w-full mt-1 px-4 py-3 rounded-xl bg-brand-cream border-none focus:ring-2 focus:ring-brand-olive/20"
									placeholder="古风, 现场, 2026"
								/>
							</div>
						</div>

						<div>
							<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
								内容
							</label>
							<textarea
								value={content}
								onChange={(event) => setContent(event.target.value)}
								rows={18}
								className="w-full mt-1 px-4 py-3 rounded-2xl bg-brand-cream border-none focus:ring-2 focus:ring-brand-olive/20 font-mono text-sm"
							/>
						</div>

						<div className="flex flex-wrap justify-end gap-3">
							<button
								onClick={handleSaveRevision}
								disabled={savingRevision || isBanned}
								className="px-6 py-2 rounded-full bg-brand-primary text-gray-900 text-sm font-bold disabled:opacity-50"
							>
								{savingRevision ? "保存中..." : "保存分支版本"}
							</button>
							{branch.status === "conflict" && (
								<button
									onClick={handleResolveConflict}
									disabled={resolvingConflict || isBanned}
									className="px-6 py-2 rounded-full bg-red-100 text-red-700 text-sm font-bold disabled:opacity-50"
								>
									{resolvingConflict ? "处理中..." : "解决冲突并重开 PR"}
								</button>
							)}
						</div>
					</div>

					<div className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8 space-y-4">
						<h2 className="text-xl font-serif font-bold text-gray-800">
							提交 Pull Request
						</h2>

						{openPr ? (
							<div className="p-4 rounded-2xl border border-brand-primary/20 bg-brand-primary/5">
								<p className="text-sm text-gray-700 mb-2">
									当前已有一个进行中的 PR。
								</p>
								<Link
									to={withThemeSearch(`/wiki/${slug}/prs/${openPr.id}`, theme)}
									className="text-sm font-bold text-brand-olive hover:underline"
								>
									查看 PR：{openPr.title}
								</Link>
							</div>
						) : (
							<>
								<div>
									<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
										PR 标题
									</label>
									<input
										type="text"
										value={prTitle}
										onChange={(event) => setPrTitle(event.target.value)}
										className="w-full mt-1 px-4 py-3 rounded-xl bg-brand-cream border-none focus:ring-2 focus:ring-brand-olive/20"
									/>
								</div>
								<div>
									<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
										说明（可选）
									</label>
									<textarea
										value={prDescription}
										onChange={(event) => setPrDescription(event.target.value)}
										rows={4}
										className="w-full mt-1 px-4 py-3 rounded-xl bg-brand-cream border-none focus:ring-2 focus:ring-brand-olive/20"
									/>
								</div>
								<div className="flex justify-end">
									<button
										onClick={handleCreatePr}
										disabled={creatingPr || isBanned}
										className="px-6 py-2 rounded-full bg-brand-olive text-white text-sm font-bold disabled:opacity-50"
									>
										{creatingPr ? "提交中..." : "创建 PR"}
									</button>
								</div>
							</>
						)}
					</div>

					<div className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8">
						<h2 className="text-xl font-serif font-bold text-gray-800 mb-4">
							分支修订历史
						</h2>
						{revisions.length ? (
							<div className="space-y-3">
								{revisions.map((revision, index) => (
									<div
										key={revision.id}
										className="p-4 rounded-2xl bg-brand-cream/30 border border-brand-cream"
									>
										<div className="flex items-center justify-between gap-3">
											<p className="text-sm font-bold text-gray-700 line-clamp-1">
												{revision.title}
											</p>
											<span className="text-[11px] text-gray-500">
												#{revisions.length - index}
											</span>
										</div>
										<p className="text-xs text-gray-500 mt-1">
											{revision.editorName} ·{" "}
											{formatDate(revision.createdAt, "yyyy-MM-dd HH:mm:ss")}
										</p>
										<p className="text-xs text-gray-400 mt-2 line-clamp-2">
											{(revision.content || "").slice(0, 160) || "无内容摘要"}
										</p>
									</div>
								))}
							</div>
						) : (
							<p className="text-gray-400 italic">暂无修订历史</p>
						)}
					</div>
				</>
			)}
		</div>
	);
};

const WikiPullRequestList = () => {
	const { slug } = useParams();
	const { theme } = useTheme();
	const { user, isAdmin } = useAuth();
	const [status, setStatus] = useState<WikiPullRequestStatus>("open");
	const [loading, setLoading] = useState(true);
	const [items, setItems] = useState<WikiPullRequestItem[]>([]);

	const fetchList = async () => {
		setLoading(true);
		try {
			const data = await apiGet<{ pullRequests: WikiPullRequestItem[] }>(
				"/api/wiki/pull-requests/list",
				{ status },
			);
			const list = data.pullRequests || [];
			setItems(slug ? list.filter((item) => item.pageSlug === slug) : list);
		} catch (error) {
			console.error("Fetch wiki PR list error:", error);
			setItems([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchList();
	}, [status, slug]);

	if (!user) {
		return (
			<div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400 italic">
				请先登录查看 PR 列表。
			</div>
		);
	}

	return (
		<div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Link
					to={withThemeSearch(slug ? `/wiki/${slug}/branches` : "/wiki", theme)}
					className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive transition-colors"
				>
					<ArrowLeft size={18} /> 返回
				</Link>
				<div className="flex gap-2">
					{(["open", "merged", "rejected"] as const).map((item) => (
						<button
							key={item}
							onClick={() => setStatus(item)}
							className={clsx(
								"px-4 py-2 rounded-full text-xs font-bold",
								status === item
									? "bg-brand-primary text-gray-900"
									: "bg-gray-100 text-gray-500 hover:bg-gray-200",
							)}
						>
							{getPrStatusText(item)}
						</button>
					))}
				</div>
			</div>

			<div className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8">
				<h1 className="text-2xl font-serif font-bold text-brand-olive mb-4">
					PR 列表 {isAdmin ? "(管理员视角)" : "(我的 PR)"}
				</h1>
				{loading ? (
					<p className="text-gray-400 italic">加载中...</p>
				) : items.length ? (
					<div className="space-y-3">
						{items.map((item) => (
							<Link
								key={item.id}
								to={withThemeSearch(
									`/wiki/${item.pageSlug}/prs/${item.id}`,
									theme,
								)}
								className="block p-4 rounded-2xl border border-gray-100 hover:border-brand-olive/30 hover:bg-brand-cream/20 transition-all"
							>
								<div className="flex flex-wrap items-center justify-between gap-3 mb-1">
									<p className="font-bold text-gray-800">{item.title}</p>
									<span
										className={clsx(
											"px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
											item.status === "open"
												? "bg-amber-100 text-amber-700"
												: item.status === "merged"
													? "bg-green-100 text-green-700"
													: "bg-red-100 text-red-700",
										)}
									>
										{getPrStatusText(item.status)}
									</span>
								</div>
								<p className="text-xs text-gray-500">
									页面：{item.page?.title || item.pageSlug} · 发起人：
									{item.createdByName}
								</p>
								<p className="text-xs text-gray-400 mt-1">
									{formatDate(item.createdAt, "yyyy-MM-dd HH:mm:ss")}
								</p>
							</Link>
						))}
					</div>
				) : (
					<p className="text-gray-400 italic">当前筛选下暂无 PR</p>
				)}
			</div>
		</div>
	);
};

const WikiPullRequestDetail = () => {
	const { slug, prId } = useParams();
	const { theme } = useTheme();
	const { user, isAdmin } = useAuth();

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [pullRequest, setPullRequest] = useState<WikiPullRequestItem | null>(
		null,
	);
	const [diff, setDiff] = useState<WikiPrDiffResponse["diff"] | null>(null);
	const [comment, setComment] = useState("");
	const { show } = useToast();

	const fetchDetail = async () => {
		if (!prId) return;
		setLoading(true);
		try {
			const [detailData, diffData] = await Promise.all([
				apiGet<{ pullRequest: WikiPullRequestItem }>(
					`/api/wiki/pull-requests/${prId}`,
				),
				apiGet<WikiPrDiffResponse>(`/api/wiki/pull-requests/${prId}/diff`),
			]);
			setPullRequest(detailData.pullRequest);
			setDiff(diffData.diff);
		} catch (error) {
			console.error("Fetch wiki PR detail error:", error);
			setPullRequest(null);
			setDiff(null);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchDetail();
	}, [prId]);

	const handleComment = async () => {
		if (!prId || !comment.trim() || saving) return;
		try {
			setSaving(true);
			await apiPost(`/api/wiki/pull-requests/${prId}/comments`, {
				content: comment.trim(),
			});
			setComment("");
			await fetchDetail();
		} catch (error) {
			console.error("Create wiki PR comment error:", error);
			show("评论失败，请稍后重试", { variant: "error" });
		} finally {
			setSaving(false);
		}
	};

	const handleAdminAction = async (action: "merge" | "reject") => {
		if (!prId || !pullRequest || saving) return;
		if (action === "merge" && !window.confirm("确认合并该 PR 吗？")) return;

		let note = "";
		if (action === "reject") {
			note =
				window.prompt("请填写驳回说明（可选）", "请根据评审意见调整后重提") ||
				"";
		}

		try {
			setSaving(true);
			await apiPost(
				`/api/wiki/pull-requests/${prId}/${action}`,
				note ? { note } : {},
			);
			await fetchDetail();
		} catch (error) {
			console.error(`${action} wiki PR error:`, error);
			show(
				action === "merge" ? "合并失败，请稍后重试" : "驳回失败，请稍后重试",
				{ variant: "error" },
			);
		} finally {
			setSaving(false);
		}
	};

	if (!user) {
		return (
			<div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400 italic">
				请先登录查看 PR 详情。
			</div>
		);
	}

	if (loading) {
		return (
			<div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400 italic">
				加载 PR 详情中...
			</div>
		);
	}

	if (!pullRequest || (slug && pullRequest.pageSlug !== slug)) {
		return (
			<div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400 italic">
				PR 不存在或无权限查看
			</div>
		);
	}

	return (
		<div className="max-w-6xl mx-auto px-4 py-12 space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Link
					to={withThemeSearch(`/wiki/${pullRequest.pageSlug}/prs`, theme)}
					className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive transition-colors"
				>
					<ArrowLeft size={18} /> 返回 PR 列表
				</Link>
				<Link
					to={withThemeSearch(`/wiki/${pullRequest.pageSlug}`, theme)}
					className="text-xs text-brand-olive hover:underline"
				>
					查看页面：{pullRequest.page?.title || pullRequest.pageSlug}
				</Link>
			</div>

			<div className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8">
				<div className="flex flex-wrap items-start justify-between gap-3 mb-4">
					<div>
						<h1 className="text-2xl font-serif font-bold text-gray-900">
							{pullRequest.title}
						</h1>
						<p className="text-xs text-gray-500 mt-1">
							发起人：{pullRequest.createdByName} ·{" "}
							{formatDate(pullRequest.createdAt, "yyyy-MM-dd HH:mm:ss")}
						</p>
					</div>
					<span
						className={clsx(
							"px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
							pullRequest.status === "open"
								? "bg-amber-100 text-amber-700"
								: pullRequest.status === "merged"
									? "bg-green-100 text-green-700"
									: "bg-red-100 text-red-700",
						)}
					>
						{getPrStatusText(pullRequest.status)}
					</span>
				</div>

				{pullRequest.description ? (
					<p className="text-sm text-gray-600 mb-5">
						{pullRequest.description}
					</p>
				) : null}

				{isAdmin && pullRequest.status === "open" && (
					<div className="flex flex-wrap gap-2 mb-5">
						<button
							onClick={() => handleAdminAction("reject")}
							disabled={saving}
							className="px-4 py-2 rounded-full bg-red-50 text-red-700 text-xs font-bold disabled:opacity-50"
						>
							驳回
						</button>
						<button
							onClick={() => handleAdminAction("merge")}
							disabled={saving}
							className="px-4 py-2 rounded-full bg-green-50 text-green-700 text-xs font-bold disabled:opacity-50"
						>
							合并
						</button>
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
						<h3 className="text-sm font-bold text-gray-700 mb-3">
							Base（主分支）
						</h3>
						{diff ? (
							<>
								<p className="text-sm font-bold text-gray-800 mb-2">
									{diff.base.title}
								</p>
								<pre className="whitespace-pre-wrap text-xs text-gray-600 leading-relaxed max-h-[420px] overflow-auto">
									{diff.base.content}
								</pre>
							</>
						) : (
							<p className="text-xs text-gray-400">暂无 diff 数据</p>
						)}
					</div>
					<div className="border border-gray-100 rounded-2xl p-4 bg-brand-cream/20">
						<h3 className="text-sm font-bold text-gray-700 mb-3">
							Head（分支版本）
						</h3>
						{diff ? (
							<>
								<p className="text-sm font-bold text-gray-800 mb-2">
									{diff.head.title}
								</p>
								<pre className="whitespace-pre-wrap text-xs text-gray-600 leading-relaxed max-h-[420px] overflow-auto">
									{diff.head.content}
								</pre>
							</>
						) : (
							<p className="text-xs text-gray-400">暂无 diff 数据</p>
						)}
					</div>
				</div>
			</div>

			<div className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8 space-y-4">
				<h2 className="text-xl font-serif font-bold text-gray-800">讨论</h2>

				{pullRequest.comments?.length ? (
					<div className="space-y-3">
						{pullRequest.comments.map((item) => (
							<div
								key={item.id}
								className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50"
							>
								<div className="flex items-center justify-between gap-2 mb-1">
									<p className="text-sm font-bold text-gray-700">
										{item.authorName}
									</p>
									<span className="text-[11px] text-gray-400">
										{formatDate(item.createdAt, "yyyy-MM-dd HH:mm:ss")}
									</span>
								</div>
								<p className="text-sm text-gray-600 whitespace-pre-wrap">
									{item.content}
								</p>
							</div>
						))}
					</div>
				) : (
					<p className="text-gray-400 italic text-sm">暂无评论</p>
				)}

				{pullRequest.status === "open" && (
					<div className="space-y-2">
						<textarea
							value={comment}
							onChange={(event) => setComment(event.target.value)}
							rows={3}
							className="w-full px-4 py-3 rounded-xl bg-brand-cream border-none focus:ring-2 focus:ring-brand-olive/20"
							placeholder="写下你的评审意见..."
						/>
						<div className="flex justify-end">
							<button
								onClick={handleComment}
								disabled={saving || !comment.trim()}
								className="px-5 py-2 rounded-full bg-brand-primary text-gray-900 text-xs font-bold disabled:opacity-50"
							>
								发表评论
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

const WikiEditor = WikiEditorComponent;

// --- Wiki History Component ---
const WikiHistory = () => {
	const { isBanned } = useAuth();
	const { slug } = useParams();
	const { theme } = useTheme();
	const [revisions, setRevisions] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedRevision, setSelectedRevision] = useState<any>(null);
	const navigate = useNavigate();
	const { show } = useToast();

	useEffect(() => {
		const fetchHistory = async () => {
			try {
				const data = await apiGet<{ revisions: any[] }>(
					`/api/wiki/${slug}/history`,
				);
				setRevisions(data.revisions || []);
			} catch (e) {
				console.error("Error fetching history:", e);
			}
			setLoading(false);
		};
		fetchHistory();
	}, [slug]);

	const handleRollback = async (revision: any) => {
		if (
			!window.confirm(
				`确定要回滚到 ${formatDate(revision.createdAt, "yyyy-MM-dd HH:mm")} 的版本吗？`,
			)
		)
			return;
		if (isBanned) {
			show("账号已被封禁，无法回滚", { variant: "error" });
			return;
		}

		try {
			await apiPost(`/api/wiki/${slug}/rollback/${revision.id}`);
			navigate(withThemeSearch(`/wiki/${slug}`, theme));
		} catch (e) {
			console.error("Rollback error:", e);
			show("回滚失败", { variant: "error" });
		}
	};

	return (
		<div className="max-w-4xl mx-auto px-4 py-12">
			<Link
				to={withThemeSearch(`/wiki/${slug}`, theme)}
				className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive mb-8 transition-colors"
			>
				<ArrowLeft size={18} /> 返回页面
			</Link>

			<div className="bg-white rounded-[40px] p-8 sm:p-12 border border-gray-100 shadow-sm">
				<h2 className="text-3xl font-serif font-bold text-brand-olive mb-8 flex items-center gap-3">
					<History size={28} /> 历史版本: {slug}
				</h2>

				{loading ? (
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<div
								key={i}
								className="h-20 bg-gray-50 rounded-2xl animate-pulse"
							></div>
						))}
					</div>
				) : revisions.length > 0 ? (
					<div className="space-y-4">
						{revisions.map((rev, i) => (
							<div
								key={rev.id}
								className="p-6 bg-brand-cream/30 border border-brand-cream rounded-3xl flex items-center justify-between group hover:bg-brand-cream transition-all"
							>
								<div className="flex items-center gap-4">
									<div className="w-10 h-10 rounded-full bg-brand-olive/10 flex items-center justify-center text-brand-olive font-bold">
										{revisions.length - i}
									</div>
									<div>
										<p className="text-sm font-bold text-gray-700">
											{formatDate(rev.createdAt, "yyyy-MM-dd HH:mm:ss")}
										</p>
										<p className="text-xs text-gray-400">
											编辑者: {rev.editorName} ({rev.editorUid.substring(0, 6)})
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<button
										onClick={() => setSelectedRevision(rev)}
										className="px-4 py-2 bg-white text-brand-olive text-xs font-bold rounded-full border border-brand-olive/20 hover:bg-brand-olive hover:text-white transition-all opacity-0 group-hover:opacity-100"
									>
										预览内容
									</button>
									<button
										onClick={() => handleRollback(rev)}
										className="px-4 py-2 bg-white text-brand-olive text-xs font-bold rounded-full border border-brand-olive/20 hover:bg-brand-olive hover:text-white transition-all opacity-0 group-hover:opacity-100"
									>
										回滚到此版本
									</button>
								</div>
							</div>
						))}
					</div>
				) : (
					<p className="text-center text-gray-400 italic py-12">暂无历史记录</p>
				)}
			</div>

			<AnimatePresence>
				{selectedRevision && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							className="bg-white rounded-[40px] w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
						>
							<div className="p-8 border-b border-gray-100 flex justify-between items-center">
								<div>
									<h3 className="text-2xl font-serif font-bold text-brand-olive">
										版本预览
									</h3>
									<p className="text-xs text-gray-400 mt-1">
										{formatDate(
											selectedRevision.createdAt,
											"yyyy-MM-dd HH:mm:ss",
										)}{" "}
										· 编辑者: {selectedRevision.editorName}
									</p>
								</div>
								<button
									onClick={() => setSelectedRevision(null)}
									className="p-2 text-gray-400 hover:text-red-500"
								>
									<X size={24} />
								</button>
							</div>
							<div className="p-8 sm:p-12 overflow-y-auto flex-grow prose prose-stone max-w-none">
								<h1 className="text-4xl font-serif font-bold text-brand-olive mb-8">
									{selectedRevision.title}
								</h1>
								<WikiMarkdown content={selectedRevision.content} />
							</div>
							<div className="p-8 border-t border-gray-100 flex justify-end gap-4">
								<button
									onClick={() => setSelectedRevision(null)}
									className="px-8 py-3 text-gray-500 font-bold hover:text-brand-olive"
								>
									关闭
								</button>
								<button
									onClick={() => {
										handleRollback(selectedRevision);
										setSelectedRevision(null);
									}}
									className="px-8 py-3 bg-brand-olive text-white rounded-full font-bold hover:bg-brand-olive/90 transition-all shadow-lg"
								>
									回滚到此版本
								</button>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</div>
	);
};

// --- Wiki Timeline Component ---
const WikiTimeline = () => {
	const { theme } = useTheme();
	const [events, setEvents] = useState<WikiItem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchEvents = async () => {
			try {
				const data = await apiGet<{ events: WikiItem[] }>("/api/wiki/timeline");
				setEvents((data.events || []).filter((p) => p.eventDate));
			} catch (e) {
				console.error("Error fetching timeline events:", e);
			}
			setLoading(false);
		};
		fetchEvents();
	}, []);

	return (
		<div className="max-w-5xl mx-auto px-4 py-12">
			<Link
				to={withThemeSearch("/wiki", theme)}
				className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive mb-8 transition-colors"
			>
				<ArrowLeft size={18} /> 返回百科列表
			</Link>

			<header className="mb-16 text-center">
				<h1 className="text-5xl font-serif font-bold text-brand-olive mb-4">
					艺术历程时间轴
				</h1>
				<p className="text-gray-500 italic">
					记录黄诗扶音乐生涯的每一个重要节点
				</p>
			</header>

			{loading ? (
				<div className="space-y-12">
					{[1, 2, 3].map((i) => (
						<div key={i} className="flex gap-8 animate-pulse">
							<div className="w-32 h-8 bg-gray-100 rounded-full"></div>
							<div className="flex-grow h-32 bg-gray-50 rounded-[32px]"></div>
						</div>
					))}
				</div>
			) : events.length > 0 ? (
				<div className="relative border-l-2 border-brand-olive/20 ml-4 md:ml-32 pl-8 md:pl-12 space-y-16 pb-20">
					{events.map((event, idx) => (
						<motion.div
							key={event.id}
							initial={{ opacity: 0, x: -20 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true }}
							className="relative"
						>
							{/* Date Indicator */}
							<div className="absolute -left-[41px] md:-left-[141px] top-0 flex items-center gap-4">
								<div className="hidden md:block w-24 text-right">
									<span className="text-sm font-bold text-brand-olive bg-brand-cream px-3 py-1 rounded-full whitespace-nowrap">
										{event.eventDate}
									</span>
								</div>
								<div className="w-4 h-4 rounded-full bg-brand-olive border-4 border-white shadow-sm z-10"></div>
							</div>

							{/* Content Card */}
							<Link
								to={withThemeSearch(`/wiki/${event.slug}`, theme)}
								className="block group"
							>
								<div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:border-brand-olive/20 transition-all">
									<div className="md:hidden mb-4">
										<span className="text-xs font-bold text-brand-olive bg-brand-cream px-2 py-1 rounded-full">
											{event.eventDate}
										</span>
									</div>
									<div className="flex items-center gap-2 mb-3">
										<span className="px-2 py-1 bg-brand-cream text-brand-olive text-[10px] font-bold uppercase tracking-wider rounded">
											{event.category === "biography"
												? "人物介绍"
												: event.category === "music"
													? "音乐作品"
													: event.category === "album"
														? "专辑一览"
														: event.category === "timeline"
															? "时间轴"
															: event.category === "event"
																? "活动记录"
																: event.category}
										</span>
									</div>
									<h3 className="text-2xl font-serif font-bold text-gray-800 group-hover:text-brand-olive transition-colors mb-4">
										{event.title}
									</h3>
									<p className="text-gray-500 text-sm italic line-clamp-2 leading-relaxed">
										{event.content.replace(/[#*`]/g, "").substring(0, 150)}...
									</p>
									<div className="mt-6 flex items-center gap-2 text-brand-olive text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
										查看详情 <ChevronRight size={14} />
									</div>
								</div>
							</Link>
						</motion.div>
					))}
				</div>
			) : (
				<div className="text-center py-20 bg-white rounded-[40px] border border-gray-100">
					<Calendar size={48} className="mx-auto text-gray-200 mb-6" />
					<p className="text-gray-400 italic">
						暂无时间轴数据，请在编辑页面设置“事件日期”
					</p>
				</div>
			)}
		</div>
	);
};

const Wiki = () => {
	return (
		<Routes>
			<Route path="/" element={<WikiList />} />
			<Route path="/new" element={<WikiEditor />} />
			<Route path="/timeline" element={<WikiTimeline />} />
			<Route path="/:slug" element={<WikiPageView />} />
			<Route path="/:slug/branches" element={<WikiBranchWorkspace />} />
			<Route path="/:slug/prs" element={<WikiPullRequestList />} />
			<Route path="/:slug/prs/:prId" element={<WikiPullRequestDetail />} />
			<Route path="/:slug/edit" element={<WikiEditor />} />
			<Route path="/:slug/history" element={<WikiHistory />} />
		</Routes>
	);
};

export default Wiki;
