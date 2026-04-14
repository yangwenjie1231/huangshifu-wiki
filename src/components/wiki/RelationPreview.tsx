import React, { useMemo } from "react";
import { motion } from "motion/react";
import { X, Edit2, Check, Link2 } from "lucide-react";
import type { WikiRelationRecord } from "./types";
import type { WikiPageMetadata } from "../../lib/wikiLinkParser";
import {
	calculateRelationQuality,
	getQualityLevelColor,
	getQualityLevelIcon,
} from "../../lib/relationQuality";
import type { WikiItem } from "../../types/entities";
import { RELATION_TYPE_LABELS } from "./types";

interface RelationPreviewProps {
	relation: WikiRelationRecord & {
		metadata?: WikiPageMetadata | null;
	};
	currentPage: WikiItem;
	onEdit?: (relation: WikiRelationRecord) => void;
	onRemove?: () => void;
	onConfirm?: () => void;
	isNew?: boolean;
	isEditing?: boolean;
}

const RelationPreview: React.FC<RelationPreviewProps> = ({
	relation,
	currentPage,
	onEdit,
	onRemove,
	onConfirm,
	isNew = false,
	isEditing = false,
}) => {
	const quality = useMemo(() => {
		return calculateRelationQuality(
			relation,
			currentPage,
			relation.metadata || null,
		);
	}, [relation, currentPage, relation.metadata]);

	const typeLabel = RELATION_TYPE_LABELS[relation.type];

	return (
		<motion.div
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			className={`p-4 rounded-2xl border-2 ${isNew || isEditing ? "border-brand-olive/30 bg-brand-olive/5" : "border-gray-100 bg-white"} hover:shadow-md transition-all`}
		>
			<div className="flex items-start justify-between gap-3 mb-3">
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-1">
						<h4 className="font-bold text-brand-olive text-base">
							{relation.metadata?.title || relation.label || relation.targetSlug}
						</h4>
						{isNew && (
						<span className="px-2 py-0.5 bg-brand-olive text-white text-[10px] font-bold rounded-full">
							新建
						</span>
					)}
					{isEditing && (
						<span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full">
							编辑中
						</span>
					)}
					</div>
					<div className="flex items-center gap-2 text-xs text-gray-500">
						<span className="flex items-center gap-1">
							<Link2 size={12} />
							{typeLabel}
						</span>
						{relation.metadata?.category && (
							<>
								<span>/</span>
								<span className="capitalize">{relation.metadata.category}</span>
							</>
						)}
					</div>
				</div>

				<div className="flex items-center gap-2">
					{/* 质量评分徽章 */}
					<div
						className={`px-2 py-1 rounded-lg text-xs font-bold ${getQualityLevelColor(quality.level)}`}
						title={`质量评分：${quality.total}/100`}
					>
						{getQualityLevelIcon(quality.level)}
					</div>

					{onEdit && (
						<button
							onClick={() => onEdit(relation)}
							className="p-1.5 text-gray-400 hover:text-brand-olive transition-colors rounded-lg hover:bg-brand-olive/10"
							title="编辑关联"
						>
							<Edit2 size={14} />
						</button>
					)}

					{onRemove && (
						<button
							onClick={onRemove}
							className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
							title="移除关联"
						>
							<X size={14} />
						</button>
					)}

					{onConfirm && isNew && (
						<button
							onClick={onConfirm}
							className="p-1.5 text-green-600 hover:text-green-700 transition-colors rounded-lg hover:bg-green-50"
							title="确认添加"
						>
							<Check size={14} />
						</button>
					)}
				</div>
			</div>

			{/* 描述信息 */}
			{relation.metadata?.description && (
				<p className="text-sm text-gray-600 mb-3 line-clamp-2">
					{relation.metadata.description}
				</p>
			)}

			{/* 封面图片 */}
			{relation.metadata?.coverImage && (
				<div className="mb-3 rounded-xl overflow-hidden">
					<img
						src={relation.metadata.coverImage}
						alt="Cover"
						className="w-full h-32 object-cover"
					/>
				</div>
			)}

			{/* 质量详情 */}
			<div className="space-y-2 mb-3">
				<div className="flex items-center justify-between text-xs">
					<span className="text-gray-500">相关性</span>
					<div className="flex items-center gap-2">
						<div className="flex-1 w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
							<div
								className="h-full bg-blue-500 rounded-full"
								style={{ width: `${(quality.relevance / 40) * 100}%` }}
							/>
						</div>
						<span className="font-bold text-gray-700 w-8 text-right">
							{quality.relevance}
						</span>
					</div>
				</div>

				<div className="flex items-center justify-between text-xs">
					<span className="text-gray-500">完整性</span>
					<div className="flex items-center gap-2">
						<div className="flex-1 w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
							<div
								className="h-full bg-purple-500 rounded-full"
								style={{ width: `${(quality.completeness / 30) * 100}%` }}
							/>
						</div>
						<span className="font-bold text-gray-700 w-8 text-right">
							{quality.completeness}
						</span>
					</div>
				</div>

				<div className="flex items-center justify-between text-xs">
					<span className="text-gray-500">重要性</span>
					<div className="flex items-center gap-2">
						<div className="flex-1 w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
							<div
								className="h-full bg-orange-500 rounded-full"
								style={{ width: `${(quality.importance / 30) * 100}%` }}
							/>
						</div>
						<span className="font-bold text-gray-700 w-8 text-right">
							{quality.importance}
						</span>
					</div>
				</div>

				<div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
					<span className="font-bold text-gray-700">总分</span>
					<span
						className={`font-bold text-lg ${quality.total >= 70 ? "text-green-600" : quality.total >= 55 ? "text-yellow-600" : "text-red-600"}`}
					>
						{quality.total}/100
					</span>
				</div>
			</div>

			{/* 改进建议 */}
			{quality.suggestions.length > 0 && (
				<div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
					<p className="text-xs font-bold text-amber-800 mb-1">
						💡 改进建议：
					</p>
					<ul className="space-y-1">
						{quality.suggestions.map((suggestion, idx) => (
							<li key={idx} className="text-xs text-amber-700 flex items-start gap-1">
								<span>•</span>
								<span>{suggestion}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{/* 元数据标签 */}
			<div className="flex flex-wrap gap-2 mt-3">
				{relation.metadata?.tags &&
					relation.metadata.tags.slice(0, 5).map((tag, idx) => (
						<span
							key={idx}
							className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-full"
						>
							#{tag}
						</span>
					))}
				{relation.metadata?.authorName && (
					<span className="px-2 py-1 bg-brand-cream text-brand-olive text-[10px] font-bold rounded-full">
						👤 {relation.metadata.authorName}
					</span>
				)}
			</div>
		</motion.div>
	);
};

export default RelationPreview;
