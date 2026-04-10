import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
	Search as SearchIcon,
	Book,
	MessageSquare,
	Image as ImageIcon,
	Clock,
	ChevronRight,
	Tag,
	Filter,
	Sparkles,
	Calendar,
	Camera,
	Music,
} from "lucide-react";
import { useUserPreferences } from "../context/UserPreferencesContext";
import { ViewModeSelector } from "../components/ViewModeSelector";
import { VIEW_MODE_CONFIG } from "../lib/viewModes";
import { format } from "date-fns";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { SmartImage } from "../components/SmartImage";
import { apiGet, apiUpload } from "../lib/apiClient";
import { toDateValue } from "../lib/dateUtils";
import { useTheme } from "../context/ThemeContext";
import { withThemeSearch, mergeSearchParamsWithTheme } from "../lib/theme";

type SearchSuggestion = {
	type: "keyword" | "wiki" | "post" | "music" | "album";
	text: string;
	subtext?: string;
	id?: string;
};

const Search = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();
	const initialQuery = searchParams.get("q") || "";
	const [searchQuery, setSearchQuery] = useState(initialQuery);
	const [results, setResults] = useState<{
		wiki: any[];
		posts: any[];
		galleries: any[];
		music: any[];
		albums: any[];
	}>({ wiki: [], posts: [], galleries: [], music: [], albums: [] });
	const [loading, setLoading] = useState(false);
	const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));
	const [activeTab, setActiveTab] = useState<
		"all" | "wiki" | "posts" | "galleries" | "music" | "albums"
	>("all");
	const { preferences, setViewMode } = useUserPreferences();
	const { theme } = useTheme();
	const viewMode = preferences.viewMode;

	// Advanced Filters
	const [showFilters, setShowFilters] = useState(false);
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
		start: "",
		end: "",
	});
	const [contentType, setContentType] = useState<
		"all" | "wiki" | "posts" | "galleries" | "music" | "albums"
	>("all");
	const [semanticImageSearch, setSemanticImageSearch] = useState(false);

	// AI Image Search
	const [aiSearching, setAiSearching] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Hot Keywords
	const [hotKeywords, setHotKeywords] = useState<string[]>([]);

	// Suggest Dropdown
	const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
	const [showSuggest, setShowSuggest] = useState(false);
	const [suggestLoading, setSuggestLoading] = useState(false);
	const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const fetchHotKeywords = async () => {
			try {
				const data = await apiGet<{
					keywords: Array<{ keyword: string; count: number }>;
				}>("/api/search/hot-keywords");
				setHotKeywords(data.keywords?.map((k) => k.keyword) || []);
			} catch (e) {
				console.error("Fetch hot keywords error:", e);
			}
		};
		fetchHotKeywords();
	}, []);

	useEffect(() => {
		if (initialQuery) {
			handleSearch(initialQuery);
		}
	}, [initialQuery]);

	const fetchSuggestions = useCallback(async (q: string) => {
		if (!q || q.length < 2) {
			setSuggestions([]);
			setShowSuggest(false);
			return;
		}
		setSuggestLoading(true);
		try {
			const data = await apiGet<{ suggestions: SearchSuggestion[] }>(
				"/api/search/suggest",
				{ q },
			);
			setSuggestions(data.suggestions || []);
			setShowSuggest(true);
		} catch (e) {
			console.error("Suggest error:", e);
		} finally {
			setSuggestLoading(false);
		}
	}, []);

	const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setSearchQuery(val);
		if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
		suggestTimeoutRef.current = setTimeout(() => fetchSuggestions(val), 300);
	};

	const handleSearch = async (q: string, filtersOverride?: any) => {
		setLoading(true);
		setHasSearched(true);
		setShowSuggest(false);
		const currentQuery = q || searchQuery;
		setSearchParams(
			mergeSearchParamsWithTheme(searchParams, { q: currentQuery }, theme),
		);
		setSearchQuery(currentQuery);

		const filters = filtersOverride || {
			selectedTags,
			dateRange,
			contentType,
			semanticImageSearch,
		};

		try {
			const typeMap: Record<string, string> = {
				wiki: "wiki",
				posts: "posts",
				galleries: "galleries",
				music: "music",
				albums: "albums",
			};
			const apiType =
				filters.contentType === "all"
					? "all"
					: typeMap[filters.contentType] || "all";

			const data = await apiGet<{
				wiki: any[];
				posts: any[];
				galleries: any[];
				music: any[];
				albums: any[];
			}>("/api/search", {
				q: currentQuery,
				type: apiType,
				...(filters.dateRange.start
					? { startDate: filters.dateRange.start }
					: {}),
				...(filters.dateRange.end ? { endDate: filters.dateRange.end } : {}),
			});

			let allResults = {
				wiki: data.wiki || [],
				posts: data.posts || [],
				galleries: data.galleries || [],
				music: data.music || [],
				albums: data.albums || [],
			};

			if (filters.semanticImageSearch && currentQuery) {
				try {
					const semanticData = await apiGet<{ galleries: any[] }>(
						"/api/search/semantic-galleries",
						{
							q: currentQuery,
							limit: 24,
						},
					);
					if (semanticData.galleries && semanticData.galleries.length > 0) {
						const existingGalleryIds = new Set(
							allResults.galleries.map((g: any) => g.id),
						);
						const newGalleries = semanticData.galleries.filter(
							(g: any) => !existingGalleryIds.has(g.id),
						);
						allResults.galleries = [...allResults.galleries, ...newGalleries];
					}
				} catch (semanticErr) {
					console.error("Semantic search error:", semanticErr);
				}
			}

			const filterFn = (item: any) => {
				const matchesTags =
					filters.selectedTags.length === 0 ||
					filters.selectedTags.every((tag) => (item.tags || []).includes(tag));
				return matchesTags;
			};

			setResults({
				wiki: allResults.wiki.filter(filterFn),
				posts: allResults.posts.filter(filterFn),
				galleries: allResults.galleries.filter(filterFn),
				music: allResults.music || [],
				albums: allResults.albums || [],
			});
		} catch (e) {
			console.error("Search error:", e);
		} finally {
			setLoading(false);
		}
	};

	const handleImageSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setAiSearching(true);
		setLoading(true);
		setHasSearched(true);
		setShowSuggest(false);
		try {
			const formData = new FormData();
			formData.append("image", file);
			formData.append("limit", "24");

			const data = await apiUpload<{ galleries: any[] }>(
				"/api/search/by-image",
				formData,
			);

			setResults({
				wiki: [],
				posts: [],
				galleries: data.galleries || [],
				music: [],
				albums: [],
			});
			setActiveTab("galleries");
		} catch (err) {
			console.error("Semantic image search error:", err);
			setResults({ wiki: [], posts: [], galleries: [], music: [], albums: [] });
		} finally {
			e.target.value = "";
			setLoading(false);
			setAiSearching(false);
		}
	};

	const toggleTag = (tag: string) => {
		setSelectedTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
		);
	};

	const totalResults =
		results.wiki.length +
		results.posts.length +
		results.galleries.length +
		results.music.length +
		results.albums.length;

	return (
		<div className="max-w-7xl mx-auto px-4 py-12">
			<div className="max-w-4xl mx-auto mb-16">
				<h1 className="text-5xl font-serif font-bold text-brand-olive mb-8 text-center">
					高级搜索
				</h1>

				<div className="bg-white rounded-[40px] p-8 shadow-xl border border-gray-100 mb-8">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleSearch(searchQuery);
						}}
						className="relative group mb-6"
					>
						<input
							type="text"
							value={searchQuery}
							onChange={handleQueryChange}
							onFocus={() =>
								searchQuery.length >= 2 && fetchSuggestions(searchQuery)
							}
							placeholder="搜索百科、帖子、图集、音乐或专辑..."
							className="w-full px-14 py-6 bg-brand-cream/30 rounded-[32px] border-none focus:ring-4 focus:ring-brand-olive/10 transition-all text-xl font-serif"
						/>
						<SearchIcon
							className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-olive/40 group-focus-within:text-brand-olive transition-colors"
							size={24}
						/>

						<AnimatePresence>
							{showSuggest && suggestions.length > 0 && (
								<motion.div
									initial={{ opacity: 0, y: -8, scale: 0.98 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									exit={{ opacity: 0, y: -8, scale: 0.98 }}
									className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden"
								>
									{suggestions.map((s, i) => (
										<button
											key={i}
											type="button"
											onClick={() => {
												if (s.type === "keyword") {
													handleSearch(s.text);
												} else {
													setShowSuggest(false);
													if (s.type === "wiki" && s.id) {
														navigate(withThemeSearch(`/wiki/${s.id}`, theme));
													} else if (s.type === "post" && s.id) {
														navigate(withThemeSearch(`/forum/${s.id}`, theme));
													} else if (s.type === "music" && s.id) {
														navigate(withThemeSearch(`/music/${s.id}`, theme));
													} else if (s.type === "album" && s.id) {
														navigate(withThemeSearch(`/album/${s.id}`, theme));
													}
												}
											}}
											className="w-full text-left px-4 py-3 hover:bg-brand-cream/50 transition-colors border-b border-gray-50 last:border-0"
										>
											<div className="flex items-center gap-3">
												<span
													className={clsx(
														"px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
														s.type === "keyword"
															? "bg-orange-100 text-orange-600"
															: s.type === "wiki"
																? "bg-brand-cream text-brand-olive"
																: s.type === "music"
																	? "bg-pink-100 text-pink-600"
																	: s.type === "album"
																		? "bg-purple-100 text-purple-600"
																		: "bg-brand-primary/10 text-brand-primary",
													)}
												>
													{s.type === "keyword"
														? "搜索"
														: s.type === "wiki"
															? "百科"
															: s.type === "music"
																? "音乐"
																: s.type === "album"
																	? "专辑"
																	: "帖子"}
												</span>
												<span className="text-sm text-gray-700">{s.text}</span>
												{s.subtext && (
													<span className="text-xs text-gray-400">
														{s.subtext}
													</span>
												)}
											</div>
										</button>
									))}
								</motion.div>
							)}
						</AnimatePresence>

						<div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								disabled={aiSearching}
								className="p-3 bg-brand-cream text-brand-olive rounded-2xl hover:bg-brand-olive hover:text-white transition-all"
								title="AI 图片搜索"
							>
								{aiSearching ? (
									<Sparkles className="animate-spin" size={20} />
								) : (
									<Camera size={20} />
								)}
							</button>
							<button
								type="submit"
								className="px-8 py-3 bg-brand-olive text-white rounded-2xl font-bold hover:bg-brand-olive/90 transition-all shadow-md"
							>
								搜索
							</button>
						</div>
						<input
							type="file"
							ref={fileInputRef}
							onChange={handleImageSearch}
							accept="image/*"
							className="hidden"
						/>
					</form>

					<div className="flex items-center justify-between">
						<div className="flex flex-wrap items-center gap-3">
							<span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
								热门:
							</span>
							{hotKeywords.slice(0, 4).map((tag) => (
								<button
									key={tag}
									onClick={() => handleSearch(tag)}
									className="px-4 py-1.5 bg-brand-cream text-brand-olive text-xs font-medium rounded-full hover:bg-brand-olive hover:text-white transition-all"
								>
									#{tag}
								</button>
							))}
						</div>
						<div className="flex items-center gap-4">
							<ViewModeSelector
								value={viewMode}
								onChange={setViewMode}
								size="sm"
							/>
							<button
								onClick={() => setShowFilters(!showFilters)}
								className={clsx(
									"flex items-center gap-2 text-sm font-bold transition-colors",
									showFilters
										? "text-brand-olive"
										: "text-gray-400 hover:text-brand-olive",
								)}
							>
								<Filter size={18} /> {showFilters ? "隐藏筛选" : "高级筛选"}
							</button>
						</div>
					</div>

					<AnimatePresence>
						{showFilters && (
							<motion.div
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: "auto", opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								className="overflow-hidden mt-8 pt-8 border-t border-gray-100"
							>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
									<div className="space-y-4">
										<h4 className="text-xs font-bold uppercase tracking-widest text-brand-olive/60 flex items-center gap-2">
											<Tag size={14} /> 标签筛选
										</h4>
										<div className="flex flex-wrap gap-2">
											{hotKeywords.map((tag) => (
												<button
													key={tag}
													onClick={() => toggleTag(tag)}
													className={clsx(
														"px-3 py-1 rounded-full text-xs transition-all",
														selectedTags.includes(tag)
															? "bg-brand-olive text-white"
															: "bg-gray-50 text-gray-400 hover:bg-gray-100",
													)}
												>
													{tag}
												</button>
											))}
										</div>
									</div>

									<div className="space-y-4">
										<h4 className="text-xs font-bold uppercase tracking-widest text-brand-olive/60 flex items-center gap-2">
											<Calendar size={14} /> 时间范围
										</h4>
										<div className="grid grid-cols-2 gap-2">
											<input
												type="date"
												value={dateRange.start}
												onChange={(e) =>
													setDateRange({ ...dateRange, start: e.target.value })
												}
												className="w-full px-3 py-2 bg-gray-50 rounded-xl border-none text-xs focus:ring-2 focus:ring-brand-olive/20"
											/>
											<input
												type="date"
												value={dateRange.end}
												onChange={(e) =>
													setDateRange({ ...dateRange, end: e.target.value })
												}
												className="w-full px-3 py-2 bg-gray-50 rounded-xl border-none text-xs focus:ring-2 focus:ring-brand-olive/20"
											/>
										</div>
									</div>

									<div className="space-y-4">
										<h4 className="text-xs font-bold uppercase tracking-widest text-brand-olive/60 flex items-center gap-2">
											<Book size={14} /> 内容类型
										</h4>
										<div className="flex flex-wrap gap-2">
											{[
												"all",
												"wiki",
												"posts",
												"galleries",
												"music",
												"albums",
											].map((type) => (
												<button
													key={type}
													onClick={() => setContentType(type as any)}
													className={clsx(
														"px-3 py-1 rounded-full text-xs transition-all capitalize",
														contentType === type
															? "bg-brand-olive text-white"
															: "bg-gray-50 text-gray-400 hover:bg-gray-100",
													)}
												>
													{type === "all" ? "全部" : type}
												</button>
											))}
										</div>
									</div>

									<div className="space-y-4">
										<h4 className="text-xs font-bold uppercase tracking-widest text-brand-olive/60 flex items-center gap-2">
											<Sparkles size={14} /> AI 搜图
										</h4>
										<div className="flex flex-wrap gap-2">
											<button
												onClick={() =>
													setSemanticImageSearch(!semanticImageSearch)
												}
												className={clsx(
													"px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1.5",
													semanticImageSearch
														? "bg-brand-olive text-white"
														: "bg-gray-50 text-gray-400 hover:bg-gray-100",
												)}
											>
												<Sparkles size={12} />
												语义搜图
											</button>
										</div>
										<p className="text-[10px] text-gray-400">
											开启后，文字搜索将同时对图集进行语义匹配
										</p>
									</div>
								</div>

								<div className="mt-8 flex justify-end gap-4">
									<button
										onClick={() => {
											setSelectedTags([]);
											setDateRange({ start: "", end: "" });
											setContentType("all");
											setSemanticImageSearch(false);
										}}
										className="text-xs font-bold text-gray-400 hover:text-red-500"
									>
										重置筛选
									</button>
									<button
										onClick={() => handleSearch(searchQuery)}
										className="px-6 py-2 bg-brand-cream text-brand-olive rounded-full text-xs font-bold hover:bg-brand-olive hover:text-white transition-all"
									>
										应用筛选
									</button>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>

			{loading ? (
				<div className="space-y-8 animate-pulse">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-32 bg-white rounded-3xl border border-gray-100"
						></div>
					))}
				</div>
			) : hasSearched ||
				selectedTags.length > 0 ||
				dateRange.start ||
				dateRange.end ? (
				<div className="space-y-12">
					<div className="flex flex-wrap gap-4 border-b border-gray-100 pb-6">
						{[
							{ id: "all", label: "全部", count: totalResults },
							{ id: "wiki", label: "百科", count: results.wiki.length },
							{ id: "posts", label: "帖子", count: results.posts.length },
							{
								id: "galleries",
								label: "图集",
								count: results.galleries.length,
							},
							{ id: "music", label: "音乐", count: results.music.length },
							{ id: "albums", label: "专辑", count: results.albums.length },
						].map((tab) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id as any)}
								className={clsx(
									"px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2",
									activeTab === tab.id
										? "bg-brand-olive text-white"
										: "bg-white text-gray-400 border border-gray-100 hover:border-brand-olive/20",
								)}
							>
								{tab.label}{" "}
								<span className="text-[10px] opacity-60 bg-black/10 px-1.5 py-0.5 rounded-full">
									{tab.count}
								</span>
							</button>
						))}
					</div>

					<div className="space-y-8">
						<AnimatePresence mode="wait">
							{(activeTab === "all" || activeTab === "wiki") &&
								results.wiki.length > 0 && (
									<motion.section
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -20 }}
										className="space-y-4"
									>
										<h2 className="text-sm font-bold text-brand-olive uppercase tracking-widest flex items-center gap-2">
											<Book size={16} /> 百科页面
										</h2>
										<div
											className={clsx(
												"grid",
												VIEW_MODE_CONFIG[viewMode].gridCols,
												VIEW_MODE_CONFIG[viewMode].gap,
											)}
										>
											{results.wiki.map((page) => (
												<Link
													key={page.id}
													to={withThemeSearch(`/wiki/${page.slug}`, theme)}
													className={clsx(
														viewMode === "list"
															? "flex gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-brand-olive/20 hover:shadow-lg transition-all w-full"
															: "bg-white p-6 rounded-3xl border border-gray-100 hover:border-brand-olive/20 hover:shadow-lg transition-all group",
													)}
												>
													{viewMode === "list" ? (
														<>
															<div className="w-24 h-24 bg-brand-cream/50 rounded-lg flex items-center justify-center flex-shrink-0">
																<Book
																	size={32}
																	className="text-brand-olive/40"
																/>
															</div>
															<div className="flex-1 min-w-0">
																<div className="flex items-center gap-2 mb-1">
																	<span className="px-2 py-0.5 bg-brand-cream text-brand-olive text-[10px] font-bold uppercase tracking-wider rounded">
																		{page.category}
																	</span>
																</div>
																<h3 className="text-lg font-serif font-bold mb-1 group-hover:text-brand-olive transition-colors truncate">
																	{page.title}
																</h3>
																<p className="text-gray-400 text-sm line-clamp-2 italic">
																	{page.content
																		.replace(/[#*`]/g, "")
																		.substring(0, 100)}
																</p>
																<p className="text-gray-300 text-xs mt-1">
																	{page.content
																		.replace(/[#*`]/g, "")
																		.substring(0, 50)}
																	...
																</p>
															</div>
														</>
													) : (
														<>
															<div className="flex items-center gap-2 mb-3">
																<span className="px-2 py-0.5 bg-brand-cream text-brand-olive text-[10px] font-bold uppercase tracking-wider rounded">
																	{page.category}
																</span>
															</div>
															<h3 className="text-xl font-serif font-bold mb-2 group-hover:text-brand-olive transition-colors">
																{page.title}
															</h3>
															<p className="text-gray-400 text-sm line-clamp-2 mb-4 italic leading-relaxed">
																{page.content
																	.replace(/[#*`]/g, "")
																	.substring(0, 100)}
																...
															</p>
															<div className="flex items-center justify-between text-gray-400 text-[10px]">
																<span className="flex items-center gap-1">
																	<Clock size={12} />{" "}
																	{toDateValue(page.updatedAt)
																		? format(
																				toDateValue(page.updatedAt)!,
																				"yyyy-MM-dd",
																			)
																		: "刚刚"}
																</span>
																<ChevronRight
																	size={14}
																	className="group-hover:translate-x-1 transition-transform"
																/>
															</div>
														</>
													)}
												</Link>
											))}
										</div>
									</motion.section>
								)}

							{(activeTab === "all" || activeTab === "posts") &&
								results.posts.length > 0 && (
									<motion.section
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -20 }}
										className="space-y-4"
									>
										<h2 className="text-sm font-bold text-brand-olive uppercase tracking-widest flex items-center gap-2">
											<MessageSquare size={16} /> 社区帖子
										</h2>
										<div className="space-y-4">
											{results.posts.map((post) => (
												<Link
													key={post.id}
													to={withThemeSearch(`/forum/${post.id}`, theme)}
													className="block bg-white p-6 rounded-3xl border border-gray-100 hover:border-brand-olive/20 hover:shadow-lg transition-all group"
												>
													<div className="flex items-center gap-2 mb-2">
														<span className="px-2 py-0.5 bg-brand-cream text-brand-olive text-[10px] font-bold uppercase tracking-wider rounded">
															{post.section}
														</span>
														<span className="text-[10px] text-gray-400 flex items-center gap-1">
															<Clock size={10} />{" "}
															{toDateValue(post.updatedAt)
																? format(
																		toDateValue(post.updatedAt)!,
																		"yyyy-MM-dd",
																	)
																: "刚刚"}
														</span>
													</div>
													<h3 className="text-xl font-serif font-bold group-hover:text-brand-olive transition-colors">
														{post.title}
													</h3>
												</Link>
											))}
										</div>
									</motion.section>
								)}

							{(activeTab === "all" || activeTab === "galleries") &&
								results.galleries.length > 0 && (
									<motion.section
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -20 }}
										className="space-y-4"
									>
										<h2 className="text-sm font-bold text-brand-olive uppercase tracking-widest flex items-center gap-2">
											<ImageIcon size={16} /> 图集馆
										</h2>
										<div
											className={clsx(
												"grid",
												VIEW_MODE_CONFIG[viewMode].gridCols,
												VIEW_MODE_CONFIG[viewMode].gap,
											)}
										>
											{results.galleries.map((gallery) => (
												<Link
													key={gallery.id}
													to={withThemeSearch(`/gallery/${gallery.id}`, theme)}
													className={clsx(
														viewMode === "list"
															? "flex gap-4 p-3 bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all w-full"
															: "bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all group",
													)}
												>
													{viewMode === "list" ? (
														<>
															<div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
																<SmartImage
																	src={gallery.images[0]?.url}
																	alt=""
																	className="w-full h-full object-cover"
																/>
															</div>
															<div className="flex-1 min-w-0 flex items-center">
																<div className="flex-1 min-w-0">
																	<h3 className="text-sm font-serif font-bold truncate group-hover:text-brand-olive transition-colors">
																		{gallery.title}
																	</h3>
																	<p className="text-xs text-gray-400">
																		{gallery.description || "暂无描述"}
																	</p>
																	<p className="text-[10px] text-gray-300 mt-1">
																		{(gallery.description || "").substring(
																			0,
																			50,
																		)}
																		...
																	</p>
																</div>
																<span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">
																	{gallery.images.length} 张
																</span>
															</div>
														</>
													) : (
														<>
															<div className="h-32 overflow-hidden">
																<SmartImage
																	src={gallery.images[0]?.url}
																	alt=""
																	className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
																/>
															</div>
															<div className="p-4">
																<h3 className="text-sm font-serif font-bold truncate group-hover:text-brand-olive transition-colors">
																	{gallery.title}
																</h3>
																<p className="text-[10px] text-gray-400">
																	{gallery.images.length} 张图片
																</p>
															</div>
														</>
													)}
												</Link>
											))}
										</div>
									</motion.section>
								)}

							{(activeTab === "all" || activeTab === "music") &&
								results.music.length > 0 && (
									<motion.section
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -20 }}
										className="space-y-4"
									>
										<h2 className="text-sm font-bold text-brand-olive uppercase tracking-widest flex items-center gap-2">
											<Music size={16} /> 音乐曲目
										</h2>
										<div
											className={clsx(
												"grid",
												VIEW_MODE_CONFIG[viewMode].gridCols,
												VIEW_MODE_CONFIG[viewMode].gap,
											)}
										>
											{results.music.map((track) => (
												<Link
													key={track.docId}
													to={withThemeSearch(`/music/${track.id}`, theme)}
													className={clsx(
														viewMode === "list"
															? "flex gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-pink-200 hover:shadow-lg transition-all w-full"
															: "bg-white p-6 rounded-3xl border border-gray-100 hover:border-pink-200 hover:shadow-lg transition-all group",
													)}
												>
													{viewMode === "list" ? (
														<>
															<div className="w-16 h-16 rounded-lg overflow-hidden bg-brand-cream flex-shrink-0">
																<SmartImage
																	src={track.cover}
																	alt=""
																	className="w-full h-full object-cover"
																/>
															</div>
															<div className="flex-1 min-w-0 flex items-center">
																<div className="flex-1 min-w-0">
																	<h3 className="text-sm font-serif font-bold truncate group-hover:text-pink-500 transition-colors">
																		{track.title}
																	</h3>
																	<p className="text-xs text-gray-500 truncate">
																		{track.artist} — {track.album}
																	</p>
																</div>
															</div>
														</>
													) : (
														<div className="flex items-center gap-4">
															<div className="w-16 h-16 rounded-xl overflow-hidden bg-brand-cream flex-shrink-0">
																<SmartImage
																	src={track.cover}
																	alt=""
																	className="w-full h-full object-cover"
																/>
															</div>
															<div className="flex-1 min-w-0">
																<h3 className="text-lg font-serif font-bold truncate group-hover:text-pink-500 transition-colors">
																	{track.title}
																</h3>
																<p className="text-sm text-gray-500 truncate">
																	{track.artist}
																</p>
																<p className="text-xs text-gray-400 truncate">
																	{track.album}
																</p>
															</div>
														</div>
													)}
												</Link>
											))}
										</div>
									</motion.section>
								)}

							{(activeTab === "all" || activeTab === "albums") &&
								results.albums.length > 0 && (
									<motion.section
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -20 }}
										className="space-y-4"
									>
										<h2 className="text-sm font-bold text-brand-olive uppercase tracking-widest flex items-center gap-2">
											<Music size={16} /> 音乐专辑
										</h2>
										<div
											className={clsx(
												"grid",
												VIEW_MODE_CONFIG[viewMode].gridCols,
												VIEW_MODE_CONFIG[viewMode].gap,
											)}
										>
											{results.albums.map((album) => (
												<Link
													key={album.docId}
													to={withThemeSearch(`/album/${album.id}`, theme)}
													className={clsx(
														viewMode === "list"
															? "flex gap-4 p-3 bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all w-full"
															: "bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all group",
													)}
												>
													{viewMode === "list" ? (
														<>
															<div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
																<SmartImage
																	src={album.cover}
																	alt=""
																	className="w-full h-full object-cover"
																/>
															</div>
															<div className="flex-1 min-w-0 flex items-center">
																<div className="flex-1 min-w-0">
																	<h3 className="text-sm font-serif font-bold truncate group-hover:text-purple-500 transition-colors">
																		{album.title}
																	</h3>
																	<p className="text-xs text-gray-400">
																		{album.artist}
																	</p>
																</div>
																<span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">
																	{album.tracksCount} 曲
																</span>
															</div>
														</>
													) : (
														<>
															<div className="h-40 overflow-hidden">
																<SmartImage
																	src={album.cover}
																	alt=""
																	className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
																/>
															</div>
															<div className="p-4">
																<h3 className="text-sm font-serif font-bold truncate group-hover:text-purple-500 transition-colors">
																	{album.title}
																</h3>
																<p className="text-[10px] text-gray-400">
																	{album.artist} · {album.tracksCount} 曲
																</p>
															</div>
														</>
													)}
												</Link>
											))}
										</div>
									</motion.section>
								)}
						</AnimatePresence>

						{totalResults === 0 && !loading && (
							<div className="bg-white p-20 rounded-[40px] border border-gray-100 text-center">
								<SearchIcon
									size={48}
									className="mx-auto text-brand-olive/20 mb-6"
								/>
								<p className="text-gray-400 italic">未找到符合筛选条件的结果</p>
							</div>
						)}
					</div>
				</div>
			) : (
				<div className="bg-white p-20 rounded-[40px] border border-gray-100 text-center">
					<Tag size={48} className="mx-auto text-brand-olive/20 mb-6" />
					<p className="text-gray-400 italic">
						输入关键词、上传图片或使用高级筛选开始探索
					</p>
				</div>
			)}
		</div>
	);
};

export default Search;
