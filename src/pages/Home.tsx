import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { HomeSkeleton } from "../components/HomeSkeleton";
import GlassCard from "../components/GlassCard";
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
	Flame,
	Play,
	Gift,
} from "lucide-react";
import { format } from "date-fns";
import { apiGet } from "../lib/apiClient";
import { toDateValue } from "../lib/dateUtils";
import { useTheme } from "../context/ThemeContext";
import { withThemeSearch, ThemeName } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import type { HomeFeedResponse as HomeFeedData } from "../types/api";

interface AnimatedStatProps {
	value: number;
	suffix?: string;
	label: string;
	icon: React.ReactNode;
}

interface BirthdayConfig {
	id: string;
	type: string;
	title: string;
	content: string;
	sortOrder: number;
	isActive: boolean;
}

const AnimatedStat: React.FC<AnimatedStatProps> = ({ value, suffix = "", label, icon }) => {
	const [ref, count, inView] = useAnimatedNumber<HTMLDivElement>(value);

	return (
		<div ref={ref} className="flex items-center gap-3 p-4 bg-white/20 rounded-2xl border border-white/20">
			<div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center text-gray-900">
				{icon}
			</div>
			<div>
				<p className="text-sm font-bold">
					{inView ? count.toLocaleString() : 0}
					{suffix}
				</p>
				<p className="text-xs text-gray-800/50">{label}</p>
			</div>
		</div>
	);
};

interface CategoryCardProps {
	cat: {
		title: string;
		icon: React.ReactNode;
		desc: string;
		link: string;
	};
	theme: ThemeName;
}

const CategoryCard: React.FC<CategoryCardProps> = React.memo(({ cat, theme }) => (
	<Link
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
));

type HomeFeedResponse = HomeFeedData;

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
	const [birthdayConfigs, setBirthdayConfigs] = useState<BirthdayConfig[]>([]);
	const [configsLoading, setConfigsLoading] = useState(true);

	useEffect(() => {
		const fetchConfigs = async () => {
			try {
				const response = await apiGet<{ data: BirthdayConfig[] }>('/api/birthday/config');
				setBirthdayConfigs(response.data || []);
			} catch (error) {
				console.error('Error fetching birthday configs:', error);
			} finally {
				setConfigsLoading(false);
			}
		};
		fetchConfigs();
	}, []);

	// 按 type 分组配置
	const getConfigsByType = (type: string) =>
		birthdayConfigs.filter((c) => c.type === type).sort((a, b) => a.sortOrder - b.sortOrder);

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
					>
						<GlassCard className={index === 0 ? 'bento-item-large' : ''}>
							<Link
								to={withThemeSearch(item.href, "academy")}
								className="w-full p-6 hover:-translate-y-0.5 transition-transform block"
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
						</GlassCard>
					</motion.div>
				))}
			</section>

			<section>
				<GlassCard className="w-full p-8 space-y-4">
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
				</GlassCard>
			</section>

			{/* 跳转到招募页 */}
			<section>
				<GlassCard className="w-full p-6 text-center">
					<p className="text-[color:var(--color-theme-muted)] mb-4">上拉页面可前往「招募与培养」</p>
					<Link
						to="/recruit"
						className="inline-flex items-center gap-2 px-6 py-3 bg-[color:var(--color-theme-accent)] text-white rounded-full font-bold hover:opacity-90 transition-opacity"
					>
						前往招募与培养 <ArrowRight size={16} />
					</Link>
				</GlassCard>
			</section>

			{/* 教务处文件通知公告 */}
			{getConfigsByType('notice').length > 0 && (
				<section>
					<GlassCard className="w-full p-6 border-l-4 border-l-red-600">
						<div className="flex items-start gap-4">
							<div className="flex-shrink-0 w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
								<Book size={32} className="text-white" />
							</div>
							<div className="flex-1">
								<h3 className="text-sm text-red-600 font-bold mb-1">从前书院教务处文件</h3>
								<h2 className="text-xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
									{getConfigsByType('notice')[0]?.title || '关于黄诗扶全国巡演的通知'}
								</h2>
								<div className="text-sm text-[color:var(--color-theme-text)]/80 leading-relaxed whitespace-pre-wrap">
									{(() => {
										try {
											const content = JSON.parse(getConfigsByType('notice')[0]?.content || '{}');
											return (
												<>
													<p><strong>公演吉期：</strong>{content.concertDate || '2026 / 06 / 19-20 19:00'}</p>
													<p><strong>雅集地点：</strong>{content.concertLocation || '上海市 · 交通银行前滩31演艺中心'}</p>
													<p className="mt-3 italic">{content.callToAction || '望各班学子奔走相告，共襄盛典。'}</p>
												</>
											);
										} catch {
											return <p>{getConfigsByType('notice')[0]?.content}</p>;
										}
									})()}
								</div>
							</div>
						</div>
					</GlassCard>
				</section>
			)}

			{/* 校史拾遗 */}
			{getConfigsByType('school_history').length > 0 && (
				<section>
					<GlassCard className="w-full p-6">
						<h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
							校史拾遗
						</h2>
						{getConfigsByType('school_history').map((config) => (
							<div key={config.id} className="mb-4">
								<h3 className="text-lg font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
									{config.title}
								</h3>
								<p className="text-[color:var(--color-theme-text)]/80 leading-relaxed whitespace-pre-wrap">
									{config.content}
								</p>
							</div>
						))}
					</GlassCard>
				</section>
			)}

			{/* 荣誉校友 */}
			{getConfigsByType('honor_alumni').length > 0 && (
				<section>
					<GlassCard className="w-full p-6">
						<h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
							荣誉校友
						</h2>
						{getConfigsByType('honor_alumni').map((config) => {
							let content = { titles: [], representativeWorks: [], description: '' };
							try {
								content = JSON.parse(config.content);
							} catch {
								content.description = config.content;
							}
							return (
								<div key={config.id} className="flex items-start gap-6">
									<div className="flex-shrink-0 w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center">
										<Music size={48} className="text-amber-600" />
									</div>
									<div className="flex-1">
										<h3 className="text-xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
											{config.title}
										</h3>
										<div className="flex flex-wrap gap-2 mb-3">
											{(content.titles || []).map((title, i) => (
												<span key={i} className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
													{title}
												</span>
											))}
										</div>
										<p className="text-sm text-[color:var(--color-theme-text)]/70 mb-2">
											<strong>代表作：</strong>{Array.isArray(content.representativeWorks) ? content.representativeWorks.join('、') : content.representativeWorks}
										</p>
										{content.description && (
											<p className="text-sm text-[color:var(--color-theme-text)]/80 leading-relaxed">
												{content.description}
											</p>
										)}
									</div>
								</div>
							);
						})}
					</GlassCard>
				</section>
			)}

			{/* 雅学之境 */}
			{getConfigsByType('campus').length > 0 && (
				<section>
					<GlassCard className="w-full p-6">
						<h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
							雅学之境
						</h2>
						{getConfigsByType('campus').map((config) => (
							<div key={config.id}>
								<h3 className="text-lg font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
									{config.title}
								</h3>
								<p className="text-[color:var(--color-theme-text)]/80 leading-relaxed mb-4">
									{config.content}
								</p>
								<div className="bg-gray-100 rounded-xl h-48 flex items-center justify-center">
									<span className="text-gray-400 italic">图片待上传</span>
								</div>
							</div>
						))}
					</GlassCard>
				</section>
			)}

			{/* 学子留言壁 */}
			{getConfigsByType('guestbook').length > 0 && (
				<section>
					<GlassCard className="w-full p-6">
						<h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
							学子留言壁
						</h2>
						<p className="text-[color:var(--color-theme-muted)] mb-4">
							{getConfigsByType('guestbook')[0]?.title || '缘起从前，一见如故'}
						</p>
						<div className="space-y-3">
							{(() => {
								let messages = [];
								try {
									messages = JSON.parse(getConfigsByType('guestbook')[0]?.content || '[]');
								} catch {
									messages = [{ nickname: '匿名', content: getConfigsByType('guestbook')[0]?.content }];
								}
								return messages.map((msg, i) => (
									<div key={i} className="p-4 bg-[color:var(--color-theme-accent)]/5 rounded-xl">
										<div className="flex items-center gap-2 mb-2">
											<span className="font-bold text-[color:var(--color-theme-accent-strong)]">@{msg.nickname}</span>
										</div>
										<p className="text-sm text-[color:var(--color-theme-text)]/80">{msg.content}</p>
									</div>
								));
							})()}
						</div>
					</GlassCard>
				</section>
			)}

			{/* 联系我们 */}
			{getConfigsByType('contact').length > 0 && (
				<section>
					<GlassCard className="w-full p-6">
						<h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
							联系我们
						</h2>
						<p className="text-[color:var(--color-theme-muted)] italic mb-6">缘起从前，一见如故</p>
						{(() => {
							let content = { department: '从前书院招生办', description: '若有心求学，望拨打专线联络。', contacts: [] };
							try {
								content = JSON.parse(getConfigsByType('contact')[0]?.content);
							} catch {
								content.description = getConfigsByType('contact')[0]?.content;
							}
							return (
								<>
									<h3 className="text-lg font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
										{content.department || '从前书院招生办'}
									</h3>
									<p className="text-[color:var(--color-theme-text)]/80 mb-4">
										{content.description || '若有心求学，望拨打专线联络。'}
									</p>
									<div className="space-y-2">
										{(content.contacts || []).map((contact, i) => (
											<div key={i} className="flex items-center gap-2">
												<span className="text-sm font-bold text-[color:var(--color-theme-accent-strong)]">【{contact.role}】</span>
												<span className="text-sm text-[color:var(--color-theme-text)]/80">{contact.name}</span>
											</div>
										))}
										{content.contacts?.length === 0 && (
											<>
												<div className="flex items-center gap-2">
													<span className="text-sm font-bold text-[color:var(--color-theme-accent-strong)]">【统理招生】</span>
													<span className="text-sm text-[color:var(--color-theme-text)]/80">卿主任</span>
												</div>
												<div className="flex items-center gap-2">
													<span className="text-sm font-bold text-[color:var(--color-theme-accent-strong)]">【传书青鸟】</span>
													<span className="text-sm text-[color:var(--color-theme-text)]/80">123456789</span>
												</div>
											</>
										)}
									</div>
								</>
							);
						})()}
					</GlassCard>
				</section>
			)}

			{/* 生贺节目大观 */}
			{getConfigsByType('program').length > 0 && (
				<section>
					<GlassCard className="w-full p-6">
						<h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
							生贺节目大观
						</h2>
						<p className="text-sm text-[color:var(--color-theme-muted)] mb-6">
							校园开放日：每年5月8日 · 节目档案陆续解锁中...
						</p>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{[
								{ type: 'music', label: '音乐', icon: Music },
								{ type: 'video', label: '视频', icon: Play },
								{ type: 'dance', label: '舞蹈', icon: Sparkles },
								{ type: 'easter', label: '彩蛋', icon: Gift },
							].map(({ type, label, icon: Icon }) => {
								const program = getConfigsByType('program').find((p) => {
									try {
										return JSON.parse(p.content).category === type;
									} catch {
										return false;
									}
								});
								return (
									<div key={type} className="p-4 bg-gradient-to-br from-[color:var(--color-theme-accent)]/10 to-[color:var(--color-theme-accent)]/5 rounded-2xl text-center">
										<Icon size={32} className="mx-auto mb-2 text-[color:var(--color-theme-accent)]" />
										<h3 className="font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-1">{label}</h3>
										{program ? (
											<p className="text-sm text-[color:var(--color-theme-text)]/80">{program.title}</p>
										) : (
											<p className="text-sm text-gray-400 italic">敬请期待</p>
										)}
									</div>
								);
							})}
						</div>
					</GlassCard>
				</section>
			)}

			<section className="bento-grid">
				{academyLecturers.map((lecturer, index) => (
					<motion.article
						key={lecturer.name}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: index * 0.1 }}
					>
						<GlassCard className="w-full p-5">
							<p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-theme-muted)] mb-2">
								{lecturer.focus}
							</p>
							<h3 className="text-lg font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
								{lecturer.name}
							</h3>
							<p className="text-sm text-[color:var(--color-theme-text)]/90 leading-relaxed">
								{lecturer.desc}
							</p>
						</GlassCard>
					</motion.article>
				))}
			</section>

			<section>
				<GlassCard className="w-full p-6">
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
				</GlassCard>
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

	if (loading) {
		return <HomeSkeleton />;
	}

	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
			{/* Hero Section - ywj 风格大字体 */}
			<section className="relative h-[70vh] min-h-[500px] rounded-[40px] overflow-hidden mb-12 shadow-2xl">
				<div className="absolute inset-0 bg-gradient-to-br from-brand-primary/35 via-white/20 to-black/30" />
				<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12 sm:p-20">
					<motion.div
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8 }}
					>
						<h1 className="text-white text-display sm:text-[100px] font-serif font-bold mb-6 leading-tight">
							黄诗扶{" "}
							<span className="text-2xl sm:text-3xl font-normal english-text opacity-80 block sm:inline ml-0 sm:ml-4">
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
					className="bento-item-large"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
				>
					<GlassCard className="w-full p-6 sm:p-8">
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
							].map((cat) => (
								<CategoryCard key={cat.title} cat={cat} theme={theme} />
							))}
						</div>
					</GlassCard>
				</motion.div>

				{/* 热门帖子 */}
				{feed?.hotPosts && feed.hotPosts.length > 0 && (
					<motion.div
						className="bento-item-tall"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						<GlassCard className="w-full p-6 sm:p-8 flex flex-col h-full">
							<div className="flex justify-between items-end mb-6">
								<h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
									<Flame size={20} className="text-orange-500" /> 热门帖子
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
						</GlassCard>
					</motion.div>
				)}

				{/* 社区动态 */}
				<motion.div
					className="bento-item-large"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
				>
					<GlassCard className="w-full p-6 sm:p-8">
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
					</GlassCard>
				</motion.div>

				{/* 加入我们 */}
				<motion.div
					className="bento-item-tall"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.3 }}
				>
					<GlassCard className="w-full p-6 sm:p-8 text-gray-900 bg-gradient-to-br from-brand-primary to-brand-primary/80">
						<div className="mb-8">
							<h2 className="text-3xl font-serif font-bold mb-4">加入我们</h2>
							<p className="text-gray-800/70 font-serif italic leading-relaxed">
								"诗扶小筑是一个由粉丝自发维护的社区。无论你是资深乐迷，还是刚被圈粉的新人，这里都有你的位置。"
							</p>
						</div>
						<div className="space-y-4">
							<AnimatedStat
								value={1240}
								suffix="+"
								label="收录曲目"
								icon={<Music size={20} />}
							/>
							<AnimatedStat
								value={5600}
								suffix="+"
								label="社区成员"
								icon={<MessageSquare size={20} />}
							/>
							<Link
								to={withThemeSearch("/forum", theme)}
								className="mt-4 px-6 py-3 bg-white text-brand-primary rounded-full font-bold hover:bg-white/90 transition-all text-center block"
							>
								立即加入
							</Link>
						</div>
					</GlassCard>
				</motion.div>
			</section>
		</div>
	);
};

export default Home;