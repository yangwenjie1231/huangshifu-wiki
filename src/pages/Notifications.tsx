import React from "react";
import {
	Bell,
	CheckCheck,
	ChevronLeft,
	ChevronRight,
	Filter,
	MessageCircle,
	ThumbsUp,
	ShieldCheck,
} from "lucide-react";
import { clsx } from "clsx";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiGet, apiPost } from "../lib/apiClient";
import { useTheme } from "../context/ThemeContext";
import { mergeSearchParamsWithTheme, withThemeSearch } from "../lib/theme";

type NotificationType = "reply" | "like" | "review_result";

type NotificationItem = {
	id: string;
	type: NotificationType;
	payload: Record<string, unknown>;
	isRead: boolean;
	createdAt: string;
};

type NotificationsResponse = {
	notifications: NotificationItem[];
	total: number;
	unreadCount: number;
	page: number;
	limit: number;
};

type NotificationFilter = "all" | NotificationType | "unread";

const PAGE_SIZE = 20;

const FILTER_OPTIONS: Array<{ id: NotificationFilter; label: string }> = [
	{ id: "all", label: "全部" },
	{ id: "unread", label: "未读" },
	{ id: "reply", label: "回复" },
	{ id: "like", label: "点赞" },
	{ id: "review_result", label: "审核结果" },
];

type ReviewNotificationPayload = {
	approved?: boolean;
	targetType?: "wiki" | "post";
	targetId?: string;
	title?: string;
	note?: string | null;
};

function isNotificationFilter(
	value: string | null,
): value is NotificationFilter {
	return (
		value === "all" ||
		value === "unread" ||
		value === "reply" ||
		value === "like" ||
		value === "review_result"
	);
}

function getNotificationText(notif: NotificationItem) {
	switch (notif.type) {
		case "reply":
			return "回复了你的" + (notif.payload.parentId ? "评论" : "帖子");
		case "like":
			return "赞了你的帖子";
		case "review_result": {
			const payload = notif.payload as ReviewNotificationPayload;
			const target =
				payload.targetType === "wiki"
					? "百科"
					: payload.targetType === "post"
						? "帖子"
						: "内容";
			const title =
				typeof payload.title === "string" && payload.title.trim()
					? `《${payload.title}》`
					: "";
			const base =
				payload.approved === true
					? `已通过你的${target}编辑审核`
					: `已驳回你的${target}编辑审核`;
			if (payload.approved === true) {
				return `${base}${title ? `：${title}` : ""}`;
			}
			const note = typeof payload.note === "string" ? payload.note.trim() : "";
			return `${base}${title ? `：${title}` : ""}${note ? `（原因：${note}）` : ""}`;
		}
		default:
			return "有新通知";
	}
}

function getNotificationLink(notif: NotificationItem) {
	if (notif.type === "reply" || notif.type === "like") {
		const postId =
			typeof notif.payload.postId === "string" ? notif.payload.postId : null;
		return postId ? `/forum/${postId}` : null;
	}

	if (notif.type === "review_result") {
		const payload = notif.payload as ReviewNotificationPayload;
		if (payload.targetType === "wiki" && typeof payload.targetId === "string") {
			return `/wiki/${payload.targetId}`;
		}
		if (payload.targetType === "post" && typeof payload.targetId === "string") {
			return `/forum/${payload.targetId}`;
		}
	}

	return null;
}

function getNotificationTypeLabel(type: NotificationType) {
	if (type === "reply") return "回复";
	if (type === "like") return "点赞";
	return "审核";
}

function NotificationTypeIcon({ type }: { type: NotificationType }) {
	if (type === "reply") {
		return <MessageCircle size={16} className="text-sky-600" />;
	}
	if (type === "like") {
		return <ThumbsUp size={16} className="text-rose-600" />;
	}
	return <ShieldCheck size={16} className="text-emerald-600" />;
}

const Notifications = () => {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { theme } = useTheme();
	const rawFilter = searchParams.get("filter");
	const filter: NotificationFilter = isNotificationFilter(rawFilter)
		? rawFilter
		: "all";
	const page = Math.max(Number(searchParams.get("page") || "1"), 1);

	const [loading, setLoading] = React.useState(false);
	const [markingAllRead, setMarkingAllRead] = React.useState(false);
	const [data, setData] = React.useState<NotificationsResponse>({
		notifications: [],
		total: 0,
		unreadCount: 0,
		page: 1,
		limit: PAGE_SIZE,
	});

	const fetchData = React.useCallback(async () => {
		setLoading(true);
		try {
			const query: Record<string, string | number | boolean> = {
				page,
				limit: PAGE_SIZE,
			};
			if (filter === "unread") {
				query.unread = true;
			}
			if (
				filter === "reply" ||
				filter === "like" ||
				filter === "review_result"
			) {
				query.type = filter;
			}

			const response = await apiGet<NotificationsResponse>(
				"/api/notifications",
				query,
			);

			setData({
				...response,
				notifications: response.notifications,
			});
		} catch (error) {
			console.error("Fetch notifications error:", error);
		} finally {
			setLoading(false);
		}
	}, [filter, page]);

	React.useEffect(() => {
		fetchData();
	}, [fetchData]);

	const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

	const updateQuery = (nextFilter: NotificationFilter, nextPage = 1) => {
		const next = mergeSearchParamsWithTheme(
			searchParams,
			{
				filter: nextFilter,
				page: String(nextPage),
			},
			theme,
		);
		setSearchParams(next);
	};

	const markNotificationRead = async (id: string) => {
		try {
			await apiPost("/api/notifications/" + id + "/read");
			setData((prev) => ({
				...prev,
				unreadCount: Math.max(0, prev.unreadCount - 1),
				notifications: prev.notifications.map((item) =>
					item.id === id ? { ...item, isRead: true } : item,
				),
			}));
		} catch (error) {
			console.error("Mark notification read error:", error);
		}
	};

	const markAllNotificationsRead = async () => {
		setMarkingAllRead(true);
		try {
			await apiPost("/api/notifications/read-all");
			setData((prev) => ({
				...prev,
				unreadCount: 0,
				notifications: prev.notifications.map((item) => ({
					...item,
					isRead: true,
				})),
			}));
		} catch (error) {
			console.error("Mark all notifications read error:", error);
		} finally {
			setMarkingAllRead(false);
		}
	};

	return (
		<div className="max-w-5xl mx-auto px-4 py-10">
			<div className="mb-6">
				<Link
					to={withThemeSearch("/", theme)}
					className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-olive transition-colors"
				>
					<ChevronLeft size={16} />
					返回首页
				</Link>
			</div>

			<section className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
				<header className="px-6 md:px-8 py-6 border-b border-gray-100">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div>
							<h1 className="text-3xl font-serif font-bold text-brand-olive flex items-center gap-3">
								<Bell size={24} />
								通知中心
							</h1>
							<p className="text-sm text-gray-500 mt-1">
								未读 {data.unreadCount} 条，共 {data.total} 条
							</p>
						</div>
						<button
							onClick={markAllNotificationsRead}
							disabled={markingAllRead || data.unreadCount === 0}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-olive text-white text-sm font-medium hover:bg-brand-olive/90 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<CheckCheck size={16} />
							{markingAllRead ? "处理中..." : "全部标记已读"}
						</button>
					</div>

					<div className="mt-5 flex flex-wrap items-center gap-2">
						<span className="inline-flex items-center gap-1 text-xs text-gray-500 px-3 py-1 rounded-full bg-gray-50">
							<Filter size={14} />
							筛选
						</span>
						{FILTER_OPTIONS.map((option) => (
							<button
								key={option.id}
								onClick={() => updateQuery(option.id, 1)}
								className={clsx(
									"px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
									filter === option.id
										? "bg-brand-olive text-white"
										: "bg-gray-50 text-gray-600 hover:bg-gray-100",
								)}
							>
								{option.label}
							</button>
						))}
					</div>
				</header>

				<div className="min-h-[360px]">
					{loading ? (
						<div className="p-8 space-y-3">
							{[1, 2, 3, 4].map((item) => (
								<div
									key={item}
									className="h-20 bg-gray-50 rounded-2xl animate-pulse"
								/>
							))}
						</div>
					) : data.notifications.length === 0 ? (
						<div className="p-16 text-center text-gray-400">
							<Bell className="mx-auto mb-4" size={42} />
							当前筛选下暂无通知
						</div>
					) : (
						<ul>
							{data.notifications.map((notif) => {
								const link = getNotificationLink(notif);
								return (
									<li
										key={notif.id}
										className={clsx(
											"px-6 md:px-8 py-4 border-b border-gray-50 last:border-b-0",
											!notif.isRead && "bg-sky-50/50",
										)}
									>
										<div className="flex items-start justify-between gap-4">
											<button
												onClick={() => {
													if (!notif.isRead) {
														markNotificationRead(notif.id);
													}
													if (link) {
														navigate(withThemeSearch(link, theme));
													}
												}}
												className="text-left flex-1"
											>
												<div className="flex items-center gap-2 mb-1">
													<NotificationTypeIcon type={notif.type} />
													<span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
														{getNotificationTypeLabel(notif.type)}
													</span>
													{!notif.isRead && (
														<span className="text-[11px] text-sky-700 font-medium">
															未读
														</span>
													)}
												</div>
												<p
													className={clsx(
														"text-sm",
														!notif.isRead
															? "font-medium text-gray-900"
															: "text-gray-700",
													)}
												>
													{getNotificationText(notif)}
												</p>
												<p className="text-xs text-gray-400 mt-1">
													{new Date(notif.createdAt).toLocaleString("zh-CN")}
												</p>
											</button>

											{!notif.isRead ? (
												<button
													onClick={() => markNotificationRead(notif.id)}
													className="text-xs text-brand-olive hover:underline"
												>
													标记已读
												</button>
											) : null}
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</div>

				<footer className="px-6 md:px-8 py-4 border-t border-gray-100 flex items-center justify-between">
					<p className="text-xs text-gray-400">
						第 {Math.min(page, totalPages)} / {totalPages} 页
					</p>
					<div className="flex items-center gap-2">
						<button
							onClick={() => updateQuery(filter, Math.max(1, page - 1))}
							disabled={page <= 1}
							className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<ChevronLeft size={14} /> 上一页
						</button>
						<button
							onClick={() =>
								updateQuery(filter, Math.min(totalPages, page + 1))
							}
							disabled={page >= totalPages}
							className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							下一页 <ChevronRight size={14} />
						</button>
					</div>
				</footer>
			</section>
		</div>
	);
};

export default Notifications;
