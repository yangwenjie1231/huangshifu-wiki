import React, {
	useState,
	useCallback,
	useRef,
	useEffect,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { apiGet } from "../../lib/apiClient";
import { useToast } from "../../components/Toast";
import type { WikiRelationType, WikiRelationRecord } from "./types";
import { RELATION_TYPE_LABELS } from "./types";

type RelationSearchSuggestion = {
	type: "keyword" | "wiki" | "post" | "music" | "album";
	text: string;
	subtext?: string;
	id?: string;
};

const parseInternalLink = (
	input: string,
): { slug: string; displayText: string } | null => {
	const match = input.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
	if (match) {
		return {
			slug: (match[2] || match[1]).trim(),
			displayText: match[1].trim(),
		};
	}
	return null;
};

interface WikiRelationsProps {
	relations: WikiRelationRecord[];
	onRelationsChange: (relations: WikiRelationRecord[]) => void;
}

const WikiRelations: React.FC<WikiRelationsProps> = ({
	relations,
	onRelationsChange,
}) => {
	const { show } = useToast();

	const [newRelation, setNewRelation] = useState<WikiRelationRecord>({
		type: "related_person",
		targetSlug: "",
		label: "",
		bidirectional: false,
	});
	const [relationSearchResults, setRelationSearchResults] = useState<
		RelationSearchSuggestion[]
	>([]);
	const [relationSearchLoading, setRelationSearchLoading] = useState(false);
	const [showRelationDropdown, setShowRelationDropdown] = useState(false);
	const [relationSelectedIndex, setRelationSelectedIndex] = useState(-1);
	const relationSearchRef = useRef<HTMLDivElement>(null);
	const relationSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const handleRelationInputChange = useCallback(
		(input: string) => {
			const internalLink = parseInternalLink(input);
			if (internalLink) {
				const shouldSetLabel =
					!newRelation.label && internalLink.displayText !== internalLink.slug;
				setNewRelation((prev) => ({
					...prev,
					targetSlug: internalLink.slug,
					label: shouldSetLabel ? internalLink.displayText : prev.label,
				}));
				setRelationSearchResults([]);
				setShowRelationDropdown(false);
				return;
			}

			setNewRelation((prev) => ({
				...prev,
				targetSlug: input,
			}));

			if (relationSearchTimeoutRef.current) {
				clearTimeout(relationSearchTimeoutRef.current);
			}
			if (!input || input.length < 2) {
				setRelationSearchResults([]);
				setShowRelationDropdown(false);
				return;
			}
			relationSearchTimeoutRef.current = setTimeout(async () => {
				setRelationSearchLoading(true);
				try {
					const data = await apiGet<{
						suggestions: RelationSearchSuggestion[];
					}>("/api/search/suggest", { q: input });
					const wikiResults =
						data.suggestions?.filter((s) => s.type === "wiki") || [];
					setRelationSearchResults(wikiResults);
					setShowRelationDropdown(wikiResults.length > 0);
					setRelationSelectedIndex(-1);
				} catch (e) {
					console.error("Relation search error:", e);
				} finally {
					setRelationSearchLoading(false);
				}
			}, 300);
		},
		[newRelation.label],
	);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				relationSearchRef.current &&
				!relationSearchRef.current.contains(e.target as Node)
			) {
				setShowRelationDropdown(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleAddRelation = () => {
		if (!newRelation.targetSlug.trim()) {
			show("请输入目标页面标识", { variant: "error" });
			return;
		}
		onRelationsChange([
			...relations,
			{
				...newRelation,
				targetSlug: newRelation.targetSlug.trim(),
			},
		]);
		setNewRelation({
			type: "related_person",
			targetSlug: "",
			label: "",
			bidirectional: false,
		});
	};

	const handleRemoveRelation = (index: number) => {
		onRelationsChange(relations.filter((_, i) => i !== index));
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">
					相关页面
				</label>
				<button
					type="button"
					onClick={handleAddRelation}
					className="px-4 py-2 bg-brand-primary/10 text-brand-primary rounded-xl text-xs font-bold hover:bg-brand-primary/20 transition-all"
				>
					+ 添加关联
				</button>
			</div>

			{relations.length > 0 && (
				<div className="space-y-2">
					{relations.map((relation, index) => (
						<div
							key={index}
							className="flex items-center gap-3 p-3 bg-brand-cream/50 rounded-xl"
						>
							<span className="text-xs text-brand-primary font-bold min-w-[80px]">
								{RELATION_TYPE_LABELS[relation.type]}
							</span>
							<span className="flex-1 text-sm truncate">
								{relation.label || relation.targetSlug}
							</span>
							{relation.bidirectional && (
								<span className="text-[10px] text-gray-400">↔ 双向</span>
							)}
							<button
								type="button"
								onClick={() => handleRemoveRelation(index)}
								className="text-gray-400 hover:text-red-500 transition-colors"
							>
								<X size={16} />
							</button>
						</div>
					))}
				</div>
			)}

			<div className="flex flex-col sm:flex-row gap-3 p-4 bg-brand-cream/30 rounded-2xl border border-brand-cream">
				<select
					value={newRelation.type}
					onChange={(e) =>
						setNewRelation({
							...newRelation,
							type: e.target.value as WikiRelationType,
						})
					}
					className="px-4 py-2 bg-white rounded-xl border border-gray-200 text-sm"
				>
					<option value="related_person">相关人物</option>
					<option value="work_relation">作品关联</option>
					<option value="timeline_relation">时间线关联</option>
					<option value="custom">自定义关系</option>
				</select>
				<div ref={relationSearchRef} className="relative flex-1">
					<input
						type="text"
						value={newRelation.targetSlug}
						onChange={(e) => {
							handleRelationInputChange(e.target.value);
						}}
						placeholder="输入 [[页面标题]] 或直接输入 slug"
						className="w-full px-4 py-2 bg-white rounded-xl border border-gray-200 text-sm"
						onKeyDown={(e) => {
							if (!showRelationDropdown) return;
							if (e.key === "ArrowDown") {
								e.preventDefault();
								setRelationSelectedIndex((prev) =>
									Math.min(prev + 1, relationSearchResults.length - 1),
								);
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								setRelationSelectedIndex((prev) =>
									Math.max(prev - 1, -1),
								);
							} else if (
								e.key === "Enter" &&
								relationSelectedIndex >= 0
							) {
								e.preventDefault();
								const selected =
									relationSearchResults[relationSelectedIndex];
								setNewRelation({
									...newRelation,
									targetSlug: selected.id || "",
								});
								setShowRelationDropdown(false);
							} else if (e.key === "Escape") {
								setShowRelationDropdown(false);
							}
						}}
					/>
					<AnimatePresence>
						{showRelationDropdown && (
							<motion.div
								initial={{ opacity: 0, y: -4 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -4 }}
								className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg max-h-60 overflow-auto"
							>
								<div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
									直接输入{" "}
									<code className="bg-gray-200 px-1 rounded">
										[[标题]]
									</code>{" "}
									格式更快
								</div>
								{relationSearchLoading ? (
									<div className="px-4 py-2 text-sm text-gray-500">
										搜索中...
									</div>
								) : relationSearchResults.length === 0 ? (
									<div className="px-4 py-2 text-sm text-gray-500">
										未找到相关页面，请尝试输入 [[页面标题]]
									</div>
								) : (
									relationSearchResults.map((result, idx) => (
										<div
											key={result.id}
											className={`px-4 py-2 cursor-pointer ${idx === relationSelectedIndex ? "bg-brand-primary/10" : "hover:bg-gray-50"}`}
											onClick={() => {
												setNewRelation({
													...newRelation,
													targetSlug: result.id || "",
												});
												setShowRelationDropdown(false);
											}}
											onMouseEnter={() =>
												setRelationSelectedIndex(idx)
											}
										>
											<div className="text-sm font-medium text-brand-olive">
												{result.text}
											</div>
											<div className="text-xs text-gray-500 truncate flex items-center gap-2">
												<span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
													{result.id}
												</span>
												<span>{result.subtext}</span>
											</div>
										</div>
									))
								)}
							</motion.div>
						)}
					</AnimatePresence>
				</div>
				<input
					type="text"
					value={newRelation.label || ""}
					onChange={(e) =>
						setNewRelation({ ...newRelation, label: e.target.value })
					}
					placeholder="显示名称 (可选)"
					className="flex-1 px-4 py-2 bg-white rounded-xl border border-gray-200 text-sm"
				/>
				<label className="flex items-center gap-2 text-xs text-gray-500 whitespace-nowrap">
					<input
						type="checkbox"
						checked={newRelation.bidirectional}
						onChange={(e) =>
							setNewRelation({
								...newRelation,
								bidirectional: e.target.checked,
							})
						}
						className="rounded"
					/>
					双向关联
				</label>
			</div>
		</div>
	);
};

export default WikiRelations;
