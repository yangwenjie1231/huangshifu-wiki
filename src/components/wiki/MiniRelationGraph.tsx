import React, { useMemo, useState, useCallback } from "react";
import { motion } from "motion/react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import type { WikiRelationRecord } from "./types";
import type { WikiPageMetadata } from "../../lib/wikiLinkParser";
import { RELATION_TYPE_LABELS } from "./types";

const RELATION_TYPE_COLORS = {
	related_person: "#3b82f6",
	work_relation: "#8b5cf6",
	timeline_relation: "#f59e0b",
	custom: "#6b7280",
};

const CENTER_POSITION = { x: 0, y: 0 };
const DEPTH_RADII = { 1: 120, 2: 220 };

interface MiniRelationGraphProps {
	relations: WikiRelationRecord[];
	metadata: Map<string, WikiPageMetadata>;
	currentSlug: string;
	currentTitle: string;
	onNodeClick?: (slug: string) => void;
	height?: number;
}

interface NodeData {
	slug: string;
	title: string;
	x: number;
	y: number;
	isCenter: boolean;
	depth: number;
}

interface EdgeData {
	sourceSlug: string;
	targetSlug: string;
	type: WikiRelationRecord["type"];
	label?: string;
}

const MiniRelationGraph: React.FC<MiniRelationGraphProps> = ({
	relations,
	metadata,
	currentSlug,
	currentTitle,
	onNodeClick,
	height = 300,
}) => {
	const [scale, setScale] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

	const width = 600;

	// 计算节点和边
	const { nodes, edges } = useMemo(() => {
		const nodesMap = new Map<string, NodeData>();
		const edgesData: EdgeData[] = [];

		// 添加中心节点
		nodesMap.set(currentSlug, {
			slug: currentSlug,
			title: currentTitle,
			x: width / 2,
			y: height / 2,
			isCenter: true,
			depth: 0,
		});

		// 添加关联节点
		relations.forEach((relation, index) => {
			const targetSlug = relation.targetSlug;
			const targetMeta = metadata.get(targetSlug);
			const targetTitle = targetMeta?.title || relation.label || targetSlug;

			// 计算位置（圆形布局）
			const angle = (2 * Math.PI * index) / relations.length;
			const radius = 120 * scale;

			const x = width / 2 + radius * Math.cos(angle) + pan.x;
			const y = height / 2 + radius * Math.sin(angle) + pan.y;

			nodesMap.set(targetSlug, {
				slug: targetSlug,
				title: targetTitle,
				x,
				y,
				isCenter: false,
				depth: 1,
			});

			edgesData.push({
				sourceSlug: currentSlug,
				targetSlug,
				type: relation.type,
				label: relation.label,
			});
		});

		return { nodes: Array.from(nodesMap.values()), edges: edgesData };
	}, [relations, metadata, currentSlug, currentTitle, width, height, scale, pan]);

	// 处理拖拽
	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			setIsDragging(true);
			setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
		},
		[pan],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!isDragging) return;
			setPan({
				x: e.clientX - dragStart.x,
				y: e.clientY - dragStart.y,
			});
		},
		[isDragging, dragStart],
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 2));
	const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
	const handleReset = () => {
		setScale(1);
		setPan({ x: 0, y: 0 });
	};

	return (
		<div className="relative rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden">
			{/* 控制按钮 */}
			<div className="absolute top-3 right-3 z-10 flex gap-2">
				<button
					onClick={handleZoomOut}
					className="p-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-all text-gray-600 hover:text-brand-olive"
					title="缩小"
				>
					<ZoomOut size={16} />
				</button>
				<button
					onClick={handleZoomIn}
					className="p-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-all text-gray-600 hover:text-brand-olive"
					title="放大"
				>
					<ZoomIn size={16} />
				</button>
				<button
					onClick={handleReset}
					className="p-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-all text-gray-600 hover:text-brand-olive"
					title="重置"
				>
					<Maximize size={16} />
				</button>
			</div>

			{/* SVG 图谱 */}
			<svg
				width={width}
				height={height}
				className="cursor-grab active:cursor-grabbing"
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
			>
				<defs>
					<marker
						id="mini-relation-arrow"
						viewBox="0 0 10 10"
						refX="9"
						refY="5"
						markerWidth="6"
						markerHeight="6"
						orient="auto-start-reverse"
					>
						<path d="M 0 0 L 10 5 L 0 10 z" fill="#5f6f52" />
					</marker>
				</defs>

				{/* 边 */}
				{edges.map((edge, idx) => {
					const source = nodes.find((n) => n.slug === edge.sourceSlug);
					const target = nodes.find((n) => n.slug === edge.targetSlug);
					if (!source || !target) return null;

					const edgeColor =
						RELATION_TYPE_COLORS[edge.type as keyof typeof RELATION_TYPE_COLORS] ||
						"#6f5f7a";

					const midX = (source.x + target.x) / 2;
					const midY = (source.y + target.y) / 2;

					return (
						<g key={idx}>
							<line
								x1={source.x}
								y1={source.y}
								x2={target.x}
								y2={target.y}
								stroke={edgeColor}
								strokeWidth={2}
								strokeOpacity={0.6}
								markerEnd="url(#mini-relation-arrow)"
							/>
							{edge.label && (
								<text
									x={midX}
									y={midY - 4}
									textAnchor="middle"
									fill={edgeColor}
									fontSize="10"
									fontWeight={600}
									style={{ textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}
								>
									{edge.label.length > 10
										? edge.label.substring(0, 10) + "..."
										: edge.label}
								</text>
							)}
						</g>
					);
				})}

				{/* 节点 */}
				{nodes.map((node) => {
					const isCenter = node.isCenter;
					const radius = isCenter ? 30 : 22;
					const nodeColor = isCenter ? "#6B8E23" : "#DEB88B";

					return (
						<g
							key={node.slug}
							transform={`translate(${node.x}, ${node.y})`}
							className={`transition-all ${!isCenter && onNodeClick ? "cursor-pointer hover:opacity-80" : ""}`}
							onClick={() => {
								if (!isCenter && onNodeClick) {
									onNodeClick(node.slug);
								}
							}}
						>
							<circle
								r={radius}
								fill={nodeColor}
								stroke={isCenter ? "#556B2F" : "#D2B48C"}
								strokeWidth={2}
								filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))"
							/>
							<text
								x={0}
								y={0}
								textAnchor="middle"
								dominantBaseline="middle"
								fill={isCenter ? "#ffffff" : "#2F2F2F"}
								fontSize={isCenter ? "12" : "10"}
								fontWeight={700}
								style={{
									textShadow: isCenter ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
								}}
							>
								{node.title.length > 8
									? node.title.substring(0, 8) + "..."
									: node.title}
							</text>
						</g>
					);
				})}
			</svg>

			{/* 图例 */}
			<div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
				{Object.entries(RELATION_TYPE_LABELS).map(([type, label]) => {
					const color =
						RELATION_TYPE_COLORS[type as keyof typeof RELATION_TYPE_COLORS] ||
						"#6f5f7a";
					return (
						<div
							key={type}
							className="flex items-center gap-1.5 px-2 py-1 bg-white/90 rounded-lg text-[10px]"
						>
							<div
								className="w-2 h-2 rounded-full"
								style={{ backgroundColor: color }}
							/>
							<span className="text-gray-600">{label}</span>
						</div>
					);
				})}
			</div>

			{/* 统计信息 */}
			<div className="absolute bottom-3 right-3 z-10 px-3 py-2 bg-white/90 rounded-lg text-[10px] text-gray-600">
								<span className="font-bold">{nodes.length}</span> 个节点 ·{" "}
								<span className="font-bold">{edges.length}</span> 条关联
			</div>
		</div>
	);
};

export default MiniRelationGraph;
