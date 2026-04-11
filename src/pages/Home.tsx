import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
	Book,
	MessageSquare,
	Music,
	Calendar,
	ArrowRight,
	Clock,
	Heart,
	Shield,
	Sparkles,
	ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { apiGet } from "../lib/apiClient";
import { toDateValue } from "../lib/dateUtils";
import { useTheme } from "../context/ThemeContext";
import { withThemeSearch } from "../lib/theme";
import { useI18n } from "../lib/i18n";

type HomeFeedResponse = {
	announcements: Array<{
		id: string;
		content: string;
		link?: string;
		createdAt: string;
	}>;
	hotPosts: any[];
	recentPosts: any[];
};

const academyHighlights = [
	{
		title: "书院山门",
		subtitle: "入门即见诗乐相逢",
		href: "/wiki?category=biography",
	},
	{ title: "练习技艺的花园", subtitle: "音乐作品与修习人次", href: "/music" },
	{ title: "游画廊", subtitle: "图集与起居陈设", href: "/gallery" },
	{
		title: "藏经阁 · 入梦课",
		subtitle: "新闻、采访与特别事迹",
		href: "/forum?section=news",
	},
];

const academyLecturers = [
	{
		name: "掌灯讲师 · 清词",
		focus: "歌诗导读",
		desc: "负责书院导览与作品脉络梳理，适合第一次进入书院的访客。",
	},
	{
		name: "值案讲师 · 归墨",
		focus: "资料校勘",
		desc: "整理百科条目与出处映射，确保阅读链路清晰、引用一致。",
	},
	{
		name: "巡夜讲师 · 听雪",
		focus: "社群引导",
		desc: "维护论坛问答秩序，提供讨论提纲与新帖引导模板。",
	},
];

const academyCopyMappings = [
	{
		section: "百科 · 人物介绍",
		defaultCopy: "生平经历、艺术风格与成就",
		academyCopy: "年谱与师承脉络，先识其人再听其歌",
	},
	{
		section: "论坛 · 动态资讯",
		defaultCopy: "参与社区讨论",
		academyCopy: "书院告示与近闻，先阅卷后议论",
	},
	{
		section: "音乐 · 曲目入口",
		defaultCopy: "原创、翻唱及合作曲目全收录",
		academyCopy: "按课序排听，配套条目可回溯",
	},
];

const AcademyHome = () => {
	const [showEasterPanel, setShowEasterPanel] = useState(false);

	return (
		<div className="academy-home-wrap max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
			<section className="academy-hero-surface theme-header-image rounded-[32px] overflow-hidden min-h-[32rem] border border-[color:var(--color-theme-border)] relative">
				<div className="academy-hero-overlay absolute inset-0" />
				<div className="relative z-10 p-8 sm:p-12 lg:p-16 flex flex-col justify-end min-h-[32rem]">
					<p className="inline-flex items-center gap-2 text-sm tracking-[0.3em] uppercase text-[color:var(--color-theme-accent-strong)]/80 mb-4">
						<Shield size={14} /> Once-Upon-An-Academy
					</p>
					<h1 className="text-5xl sm:text-7xl font-serif font-bold leading-tight text-[color:var(--color-theme-accent-strong)] mb-4">
						从前书院
					</h1>
					<p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-[color:var(--color-theme-text)]/90 mb-6">
						歌诗相逢，入梦成课。这里是黄诗扶生日特别版书院，所有阅读、浏览与聆听都在一处静静展开。
					</p>
					<div className="flex flex-wrap gap-3">
						<Link
							to={withThemeSearch("/music", "academy")}
							className="px-5 py-3 bg-[color:var(--color-theme-accent)] text-white rounded-full font-medium"
						>
							进入书院
						</Link>
						<Link
							to={withThemeSearch("/wiki", "academy")}
							className="px-5 py-3 border border-[color:var(--color-theme-border)] rounded-full font-medium text-[color:var(--color-theme-accent-strong)] bg-white/70"
						>
							查看年谱
						</Link>
					</div>
				</div>
			</section>

			<section className="bento-grid">
				{academyHighlights.map((item, index) => (
					<motion.div
						key={item.title}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: index * 0.1 }}
						className={`liquidGlass-wrapper bg-white ${index === 0 ? 'bento-item-large' : ''}`}
					>
						<div className="liquidGlass-effect"></div>
						<div className="liquidGlass-tint"></div>
						<div className="liquidGlass-shine"></div>
						<Link
							to={withThemeSearch(item.href, "academy")}
							className="liquidGlass-text w-full p-6 hover:-translate-y-0.5 transition-transform"
						>
							<h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
								{item.title}
							</h2>
							<p className="text-[color:var(--color-theme-muted)] mb-4">
								{item.subtitle}
							</p>
							<span className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-theme-accent)]">
								前往 <ChevronRight size={14} />
							</span>
						</Link>
					</motion.div>
				))}
			</section>

			<section className="liquidGlass-wrapper bg-white">
				<div className="liquidGlass-effect"></div>
				<div className="liquidGlass-tint"></div>
				<div className="liquidGlass-shine"></div>
				<div className="liquidGlass-text w-full p-8 space-y-4">
					<h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)]">
						书院开篇
					</h2>
					<p className="leading-relaxed text-[color:var(--color-theme-text)]/90">
						黄诗扶，出生于上海，毕业于英国布里斯托大学，曾为上海师范大学音乐学院校友并回母校捐赠个人专辑。
						公开资料中，她的代表作包含《吹梦到西洲》《人间不值得》《九万字》等，适合作为生日特别版主题的公开文案依据。
					</p>
					<p className="leading-relaxed text-[color:var(--color-theme-text)]/90">
						生贺期间，这里将默认进入无感浏览状态，仅保留阅读、播放与浏览。
					</p>
					<button
						type="button"
						onClick={() => setShowEasterPanel((prev) => !prev)}
						className="academy-easter-button inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--color-theme-accent)]"
					>
						<Sparkles size={12} /> 书院暗号
					</button>
					{showEasterPanel && (
						<div className="academy-easter-panel rounded-xl p-4 space-y-2">
							<h3 className="text-sm font-bold text-[color:var(--color-theme-accent-strong)]">
								彩蛋 · 夜读口令
							</h3>
							<p className="text-sm text-[color:var(--color-theme-muted)]">
								今夜口令为「吹梦到西洲」，在百科、论坛、音乐三处都能看到对应映射提示。
							</p>
						</div>
					)}
				</div>
			</section>

			<section className="bento-grid">
				{academyLecturers.map((lecturer, index) => (
					<motion.article
						key={lecturer.name}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: index * 0.1 }}
						className="liquidGlass-wrapper bg-white"
					>
						<div className="liquidGlass-effect"></div>
						<div className="liquidGlass-tint"></div>
						<div className="liquidGlass-shine"></div>
						<div className="liquidGlass-text w-full p-5">
							<p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-theme-muted)] mb-2">
								{lecturer.focus}
							</p>
							<h3 className="text-lg font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
								{lecturer.name}
							</h3>
							<p className="text-sm text-[color:var(--color-theme-text)]/90 leading-relaxed">
								{lecturer.desc}
							</p>
						</div>
					</motion.article>
				))}
			</section>

			<section className="liquidGlass-wrapper bg-white">
				<div className="liquidGlass-effect"></div>
				<div className="liquidGlass-tint"></div>
				<div className="liquidGlass-shine"></div>
				<div className="liquidGlass-text w-full p-6">
					<h2 className="text-xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
						书院文案映射
					</h2>
					<div className="overflow-x-auto">
						<table className="academy-mapping-table w-full border-collapse rounded-lg overflow-hidden text-sm">
							<thead>
								<tr>
									<th className="border px-3 py-2 text-left">版块</th>
									<th className="border px-3 py-2 text-left">默认文案</th>
									<th className="border px-3 py-2 text-left">书院文案</th>
								</tr>
							</thead>
							<tbody>
								{academyCopyMappings.map((row) => (
									<tr key={row.section}>
										<td className="border px-3 py-2 font-medium">
											{row.section}
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
				</div>
			</section>
		</div>
	);
};

const Home = () => {
	const { isAcademy, theme } = useTheme();
	const { t } = useI18n();
	const [feed, setFeed] = useState<HomeFeedResponse | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (isAcademy) {
			setLoading(false);
			return;
		}

		const fetchFeed = async () => {
			try {
				const data = await apiGet<HomeFeedResponse>("/api/home/feed");
				setFeed(data);
			} catch (e) {
				console.error("Error fetching home feed:", e);
			}
			setLoading(false);
		};
		fetchFeed();
	}, [isAcademy]);

	if (isAcademy) {
		return <AcademyHome />;
	}

	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
			{/* Hero Section */}
			<section className="relative h-[70vh] min-h-[500px] rounded-[40px] overflow-hidden mb-12 shadow-2xl">
				<div className="absolute inset-0 bg-gradient-to-br from-brand-primary/35 via-white/20 to-black/30" />
				<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12 sm:p-20">
					<motion.div
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8 }}
					>
						<h1 className="text-white text-6xl sm:text-8xl font-serif font-bold mb-6 leading-tight">
							黄诗扶{" "}
							<span className="text-3xl sm:text-4xl font-normal italic opacity-80 block sm:inline ml-0 sm:ml-4">
								Huang Shifu
							</span>
						</h1>
						<p className="text-white/80 text-xl font-serif italic max-w-2xl mb-10 leading-relaxed">
							"以诗入乐，以乐咏诗。在这里，探索关于黄诗扶的一切。"
						</p>
						<div className="flex flex-wrap gap-4">
							<Link
								to={withThemeSearch("/wiki", theme)}
								className="px-8 py-4 bg-brand-primary text-gray-900 rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-lg"
							>
								进入百科 <ArrowRight size={20} />
							</Link>
							<Link
								to={withThemeSearch("/forum", theme)}
								className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-full font-medium hover:bg-white/20 transition-all"
							>
								参与社区讨论
							</Link>
						</div>
					</motion.div>
				</div>
			</section>

			{/* Bento Grid Layout */}
			<section className="bento-grid mb-16">
				{/* 百科全书 */}
				<motion.div 
					className="bento-item-large liquidGlass-wrapper bg-white"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
				>
					<div className="liquidGlass-effect"></div>
					<div className="liquidGlass-tint"></div>
					<div className="liquidGlass-shine"></div>
					<div className="liquidGlass-text w-full p-6 sm:p-8">
						<div className="flex justify-between items-end mb-8">
							<div>
								<h2 className="text-4xl font-serif font-bold text-gray-900 mb-2">
									百科全书
								</h2>
								<p className="text-gray-500 italic">Wiki Encyclopedia</p>
							</div>
							<Link
								to={withThemeSearch("/wiki", theme)}
								className="text-brand-primary font-bold flex items-center gap-1 hover:underline"
							>
								查看全部 <ArrowRight size={16} />
							</Link>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
							{[
								{
									title: "人物介绍",
									icon: <Book size={32} />,
									desc: "生平经历、艺术风格与成就",
									link: "/wiki?category=biography",
								},
								{
									title: "音乐作品",
									icon: <Music size={32} />,
									desc: "原创、翻唱及合作曲目全收录",
									link: "/music",
								},
								{
									title: "专辑一览",
									icon: <Book size={32} />,
									desc: "历年发行专辑与EP详情",
									link: "/wiki?category=album",
								},
								{
									title: "活动记录",
									icon: <Calendar size={32} />,
									desc: "演出、直播与线下活动时间线",
									link: "/wiki?category=event",
								},
							].map((cat, i) => (
								<Link
									key={cat.title}
									to={withThemeSearch(cat.link, theme)}
									className="flex items-start gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-all group"
								>
									<div className="text-brand-primary group-hover:scale-110 transition-transform">
										{cat.icon}
									</div>
									<div>
										<h3 className="text-xl font-serif font-bold mb-1">
											{cat.title}
										</h3>
										<p className="text-gray-500 text-sm leading-relaxed">
											{cat.desc}
										</p>
									</div>
								</Link>
							))}
						</div>
					</div>
				</motion.div>

				{/* 热门帖子 */}
				{feed?.hotPosts && feed.hotPosts.length > 0 && (
					<motion.div 
						className="bento-item-tall liquidGlass-wrapper bg-white"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						<div className="liquidGlass-effect"></div>
						<div className="liquidGlass-tint"></div>
						<div className="liquidGlass-shine"></div>
						<div className="liquidGlass-text w-full p-6 sm:p-8 flex flex-col h-full">
							<div className="flex justify-between items-end mb-6">
								<h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
									🔥 热门帖子
								</h2>
								<Link
									to={withThemeSearch("/forum?sort=hot", theme)}
									className="text-brand-primary font-bold text-sm hover:underline"
								>
									查看更多
								</Link>
							</div>
							<div className="space-y-4 flex-grow">
								{feed.hotPosts.slice(0, 4).map((post) => (
									<Link
										key={post.id}
										to={withThemeSearch(`/forum/${post.id}`, theme)}
										className="block p-4 rounded-2xl bg-brand-primary/5 border border-brand-primary/10 hover:border-brand-primary/30 transition-all cursor-pointer group"
									>
										<div className="flex items-center gap-2 mb-2">
											<span className="px-2 py-1 bg-brand-primary/20 text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded">
												{post.section === "music"
													? "音乐讨论"
													: post.section === "news"
														? "动态资讯"
														: post.section === "fanart"
															? "二创交流"
															: "问答区"}
											</span>
										</div>
										<h4 className="text-base font-serif font-bold mb-2 group-hover:text-brand-primary transition-colors line-clamp-2">
											{post.title}
										</h4>
										<div className="flex items-center gap-4 text-gray-400 text-sm">
											<span className="flex items-center gap-1">
												<MessageSquare size={14} /> {post.commentsCount || 0}
											</span>
											<span className="flex items-center gap-1">
												<Heart size={14} /> {post.likesCount || 0}
											</span>
										</div>
									</Link>
								))}
							</div>
						</div>
					</motion.div>
				)}

				{/* 社区动态 */}
				<motion.div 
					className="bento-item-large liquidGlass-wrapper bg-white"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
				>
					<div className="liquidGlass-effect"></div>
					<div className="liquidGlass-tint"></div>
					<div className="liquidGlass-shine"></div>
					<div className="liquidGlass-text w-full p-6 sm:p-8">
						<div className="flex justify-between items-end mb-6">
							<h2 className="text-3xl font-serif font-bold text-gray-900">
								社区动态
							</h2>
							<Link
								to={withThemeSearch("/forum", theme)}
								className="text-brand-primary font-bold text-sm hover:underline"
							>
								更多讨论
							</Link>
						</div>
						<div className="space-y-4">
							{loading ? (
								[1, 2, 3].map((i) => (
									<div
										key={i}
										className="h-20 bg-gray-100 rounded-2xl animate-pulse"
									></div>
								))
							) : (feed?.recentPosts?.length ?? 0) > 0 ? (
								feed!.recentPosts.slice(0, 3).map((post) => (
									<Link
										key={post.id}
										to={withThemeSearch(`/forum/${post.id}`, theme)}
										className="block p-4 rounded-2xl bg-white border border-gray-100 hover:border-brand-primary/20 transition-all cursor-pointer group"
									>
										<div className="flex items-center gap-2 mb-2">
											<span className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded">
												{post.section === "music"
													? "音乐讨论"
													: post.section === "news"
														? "动态资讯"
														: post.section === "fanart"
															? "二创交流"
															: "问答区"}
											</span>
											<span className="text-gray-400 text-xs flex items-center gap-1">
												<Clock size={12} />{
													toDateValue(post.updatedAt)
														? format(toDateValue(post.updatedAt)!, "MM-dd HH:mm")
														: "刚刚"
												}
											</span>
										</div>
										<h4 className="text-lg font-serif font-bold mb-2 group-hover:text-brand-primary transition-colors">
											{post.title}
										</h4>
										<div className="flex items-center gap-4 text-gray-400 text-sm">
											<span className="flex items-center gap-1">
												<MessageSquare size={14} /> {post.commentsCount || 0}
											</span>
											<span className="flex items-center gap-1">
												<Heart size={14} /> {post.likesCount || 0}
											</span>
										</div>
									</Link>
								))
							) : (
								<div className="bg-white p-8 rounded-2xl border border-gray-100 text-center italic text-gray-400">
									暂无社区动态
								</div>
							)}
						</div>
					</div>
				</motion.div>

				{/* 加入我们 */}
				<motion.div 
					className="bento-item-tall liquidGlass-wrapper bg-gradient-to-br from-brand-primary to-brand-primary/80"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.3 }}
				>
					<div className="liquidGlass-effect"></div>
					<div className="liquidGlass-tint"></div>
					<div className="liquidGlass-shine"></div>
					<div className="liquidGlass-text w-full p-6 sm:p-8 text-gray-900 flex flex-col justify-between h-full">
						<div>
							<h2 className="text-3xl font-serif font-bold mb-6">加入我们</h2>
							<p className="text-gray-800/70 font-serif italic leading-relaxed mb-8">
								"诗扶小筑是一个由粉丝自发维护的社区。无论你是资深乐迷，还是刚被圈粉的新人，这里都有你的位置。"
							</p>
						</div>
						<div className="space-y-4">
							<div className="flex items-center gap-3 p-4 bg-white/20 rounded-2xl border border-white/20">
								<div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center">
									<Music size={20} />
								</div>
								<div>
									<p className="text-sm font-bold">1,240+</p>
									<p className="text-xs text-gray-800/50">收录曲目</p>
								</div>
							</div>
							<div className="flex items-center gap-3 p-4 bg-white/20 rounded-2xl border border-white/20">
								<div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center">
									<MessageSquare size={20} />
								</div>
								<div>
									<p className="text-sm font-bold">5,600+</p>
									<p className="text-xs text-gray-800/50">社区成员</p>
								</div>
							</div>
							<Link
								to={withThemeSearch("/forum", theme)}
								className="mt-4 px-6 py-3 bg-white text-brand-primary rounded-full font-bold hover:bg-white/90 transition-all text-center"
							>
								立即加入
							</Link>
						</div>
					</div>
				</motion.div>
			</section>
		</div>
	);
};

export default Home;