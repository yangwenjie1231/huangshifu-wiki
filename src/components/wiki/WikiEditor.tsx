import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../components/Toast";
import { apiGet, apiPost, apiPut } from "../../lib/apiClient";
import { randomId } from "../../lib/randomId";
import { withThemeSearch } from "../../lib/theme";
import { splitTagsInput } from "../../lib/contentUtils";
import { generateWikiIntro } from "../../services/aiService";
import { uploadMarkdownImage } from "../../services/imageService";
import { X, Save, Sparkles } from "lucide-react";
import MdEditor from "react-markdown-editor-lite";
import MarkdownIt from "markdown-it";
import "react-markdown-editor-lite/lib/index.css";
import { LocationTagInput } from "../../components/LocationTagInput";
import WikiRelations from "./WikiRelations";
import type { WikiItemWithRelations, WikiRelationRecord } from "./types";

const mdParser = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
});

const WikiEditor = () => {
	const { slug } = useParams();
	const isNew = !slug || slug === "new";
	const navigate = useNavigate();
	const { user, profile, isAdmin, isBanned } = useAuth();
	const { theme } = useTheme();

	const [formData, setFormData] = useState({
		title: "",
		slug: "",
		category: "biography",
		content: "",
		tags: "",
		eventDate: "",
		relations: [] as WikiRelationRecord[],
		locationCode: "",
		locationName: "",
	});
	const [savingMode, setSavingMode] = useState<"draft" | "pending" | null>(
		null,
	);
	const [generating, setGenerating] = useState(false);
	const { show } = useToast();

	useEffect(() => {
		if (!isNew) {
			const fetchPage = async () => {
				try {
					const response = await apiGet<{ page: WikiItemWithRelations }>(
						`/api/wiki/${slug}`,
					);
					const data = response.page;
					setFormData({
						title: data.title,
						slug: data.slug,
						category: data.category,
						content: data.content,
						tags: data.tags?.join(", ") || "",
						eventDate: data.eventDate || "",
						relations: (data.relations as WikiRelationRecord[]) || [],
						locationCode: data.locationCode || "",
						locationName: data.locationName || "",
					});
				} catch (error) {
					console.error("Error fetching wiki page for edit:", error);
				}
			};
			fetchPage();
		}
	}, [slug, isNew]);

	const handleLocationChange = (locationName: string, locationCode: string) => {
		setFormData({ ...formData, locationName, locationCode });
	};

	const handleLocationClear = () => {
		setFormData({ ...formData, locationName: "", locationCode: "" });
	};

	const handleRelationsChange = (relations: WikiRelationRecord[]) => {
		setFormData({ ...formData, relations });
	};

	const handleSubmit = async (status: "draft" | "pending") => {
		if (!user) return;
		if (isBanned) {
			show("账号已被封禁，无法编辑百科", { variant: "error" });
			return;
		}

		if (formData.category === "music" && !isAdmin) {
			show("只有管理员可以修改音乐分类的内容", { variant: "error" });
			return;
		}

		if (!formData.title.trim()) {
			show("请填写标题（*为必填项）", { variant: "error" });
			return;
		}
		if (!formData.category) {
			show("请选择分类（*为必填项）", { variant: "error" });
			return;
		}
		if (!formData.content.trim()) {
			show("请填写内容（*为必填项）", { variant: "error" });
			return;
		}

		const pageSlug = (
			isNew ? formData.slug || formData.title : slug || formData.slug
		)
			?.trim()
			.toLowerCase()
			.replace(/[\\/]/g, "-")
			.replace(/\s+/g, "-");

		if (!pageSlug) {
			show("请先填写标题以生成页面标识", { variant: "error" });
			return;
		}

		setSavingMode(status);

		const pageData: any = {
			title: formData.title,
			slug: pageSlug,
			category: formData.category,
			content: formData.content,
			tags: formData.tags
				.split(",")
				.map((t) => t.trim())
				.filter((t) => t),
			eventDate: formData.eventDate,
			relations: formData.relations,
			locationCode: formData.locationCode || null,
			locationName: formData.locationName || null,
			status,
			lastEditorUid: user.uid,
			lastEditorName: profile?.displayName || user.displayName || "匿名用户",
		};

		try {
			if (isNew) {
				try {
					await apiGet<{ page: WikiItemWithRelations }>(`/api/wiki/${pageSlug}`);
					show("该页面标识已存在，请修改标题后重试", { variant: "error" });
					setSavingMode(null);
					return;
				} catch {
					// continue when page does not exist
				}

				const existingByTitle = await apiGet<{ pages: WikiItemWithRelations[] }>(
					"/api/wiki",
					{
						category: "all",
					},
				);
				const duplicatedTitle = (existingByTitle.pages || []).some(
					(item) => item.title.trim() === formData.title.trim(),
				);

				if (duplicatedTitle) {
					show("该标题的百科已存在，请修改标题或编辑已有页面", {
						variant: "error",
					});
					setSavingMode(null);
					return;
				}

				await apiPost("/api/wiki", pageData);
			} else {
				await apiPut(`/api/wiki/${pageSlug}`, pageData);
			}

			await apiPost(`/api/wiki/${pageSlug}/revisions`, {
				id: randomId(),
				pageSlug,
				title: formData.title,
				content: formData.content,
				editorUid: user.uid,
				editorName: profile?.displayName || user.displayName || "匿名用户",
			});

			navigate(withThemeSearch(`/wiki/${pageSlug}`, theme));
		} catch (e) {
			console.error("Error saving wiki page:", e);
			show("保存失败，请检查网络或权限", { variant: "error" });
		}
		setSavingMode(null);
	};

	return (
		<div className="max-w-5xl mx-auto px-4 py-12">
			<div className="bg-white rounded-[40px] p-8 sm:p-16 border border-gray-100 shadow-sm">
				<div className="flex justify-between items-center mb-12">
					<h1 className="text-4xl font-serif font-bold text-brand-olive">
						{isNew ? "创建新百科" : "编辑百科"}
					</h1>
					<button
						onClick={() => navigate(-1)}
						className="p-2 text-gray-400 hover:text-red-500"
					>
						<X size={24} />
					</button>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleSubmit("pending");
					}}
					className="space-y-8"
				>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						<div className="space-y-2">
							<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
								标题
							</label>
							<input
								type="text"
								required
								value={formData.title}
								onChange={(e) =>
									setFormData({ ...formData, title: e.target.value })
								}
								placeholder="例如：黄诗扶"
								className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-olive/20 font-serif text-xl"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
								分类
							</label>
							<select
								value={formData.category}
								onChange={(e) =>
									setFormData({ ...formData, category: e.target.value })
								}
								className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-olive/20 font-serif text-xl appearance-none"
							>
								<option value="biography">人物介绍</option>
								<option value="music">音乐作品</option>
								<option value="album">专辑一览</option>
								<option value="timeline">时间线</option>
								<option value="event">活动记录</option>
							</select>
						</div>
						<div className="space-y-2">
							<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
								事件日期 (可选)
							</label>
							<input
								type="date"
								value={formData.eventDate}
								onChange={(e) =>
									setFormData({ ...formData, eventDate: e.target.value })
								}
								className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-olive/20 font-serif text-xl"
							/>
						</div>
					</div>

					<div className="space-y-2">
						<div className="flex justify-between items-center">
							<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
								内容 (Markdown) <span className="text-red-500">*</span>
							</label>
							<button
								type="button"
								onClick={async () => {
									if (!formData.title)
										return show("请先输入标题", { variant: "error" });
									setGenerating(true);
									const intro = await generateWikiIntro(formData.title);
									if (intro)
										setFormData({
											...formData,
											content: intro + "\n\n" + formData.content,
										});
									setGenerating(false);
								}}
								disabled={generating}
								className="text-xs font-bold text-brand-olive flex items-center gap-1 hover:underline disabled:opacity-50"
							>
								<Sparkles size={12} />{" "}
								{generating ? "生成中..." : "AI 辅助写开头"}
							</button>
						</div>
						<div className="border border-gray-100 rounded-[32px] overflow-hidden">
							<MdEditor
								style={{ height: "500px" }}
								renderHTML={(text) => {
									const processed = text.replace(
										/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
										(match, p1, p2) => {
											const display = p1.trim();
											const slug = p2 ? p2.trim() : p1.trim();
											return `[${display}](/wiki/${slug})`;
										},
									);
									return mdParser.render(processed);
								}}
								value={formData.content}
								onChange={({ text }) =>
									setFormData({ ...formData, content: text })
								}
								onImageUpload={uploadMarkdownImage}
								placeholder="在这里输入百科内容，支持 Markdown 语法..."
								config={{
									view: {
										menu: true,
										md: true,
										html: false,
									},
									canView: {
										menu: true,
										md: true,
										html: true,
										fullScreen: true,
										hideMenu: false,
									},
								}}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
							标签 (逗号分隔)
						</label>
						<input
							type="text"
							value={formData.tags}
							onChange={(e) =>
								setFormData({ ...formData, tags: e.target.value })
							}
							placeholder="例如：古风, 原创, 歌手"
							className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-olive/20"
						/>
					</div>

					<div className="space-y-2">
						<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
							地点
						</label>
						<LocationTagInput
							value={formData.locationName || null}
							locationCode={formData.locationCode || null}
							onChange={handleLocationChange}
							onClear={handleLocationClear}
						/>
					</div>

					<WikiRelations
						relations={formData.relations}
						onRelationsChange={handleRelationsChange}
					/>

					<div className="pt-8 flex flex-wrap justify-end gap-3">
						<button
							type="button"
							onClick={() => handleSubmit("draft")}
							disabled={Boolean(savingMode)}
							className="px-8 py-4 bg-gray-100 text-gray-700 rounded-full font-bold hover:bg-gray-200 transition-all flex items-center gap-2 disabled:opacity-50"
						>
							<Save size={18} />{" "}
							{savingMode === "draft" ? "保存中..." : "保存草稿"}
						</button>
						<button
							type="submit"
							disabled={Boolean(savingMode)}
							className="px-12 py-4 bg-brand-olive text-white rounded-full font-bold hover:bg-brand-olive/90 hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
						>
							<Sparkles size={18} />{" "}
							{savingMode === "pending" ? "提交中..." : "提交审核"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default WikiEditor;
