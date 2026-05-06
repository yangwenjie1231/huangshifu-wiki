import React, { useMemo, useState, useCallback, useRef } from "react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import type { WikiRelationRecord } from "./types";
import type { WikiPageMetadata } from "../../lib/wikiLinkParser";
import { RELATION_TYPE_LABELS } from "./types";
import {
	RELATION_GRAPH_TYPE_COLORS,
	buildMiniRelationGraphData,
	getRelationGraphEdgeColor,
	getRelationGraphEdgeLabel,
	getRelationGraphNodeStyle,
	isRelationGraphNodeClickable,
	layoutRelationGraphRadial,
	truncateGraphLabel,
} from "../../lib/wikiRelationGraph";

interface MiniRelationGraphProps {
	relations: WikiRelationRecord[];
	metadata: Map<string, WikiPageMetadata>;
	currentSlug: string;
	currentTitle: string;
	onNodeClick?: (slug: string) => void;
	height?: number;
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

	const svgRef = useRef<SVGSVGElement>(null);
	const touchState = useRef({
		lastTouchX: 0,
		lastTouchY: 0,
		lastTouchDistance: 0,
		isPinching: false,
	});

	const width = 600;

	const graph = useMemo(
		() =>
			buildMiniRelationGraphData({
				relations,
				metadata,
				currentSlug,
				currentTitle,
			}),
		[relations, metadata, currentSlug, currentTitle],
	);

	const nodes = useMemo(
		() => layoutRelationGraphRadial(graph, { width, height, scale, pan }),
		[graph, width, height, scale, pan],
	);

	const nodeBySlug = useMemo(
		() => new Map(nodes.map((node) => [node.slug, node])),
		[nodes],
	);

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

	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		if (e.touches.length === 1) {
			const touch = e.touches[0];
			setIsDragging(true);
			touchState.current.lastTouchX = touch.clientX;
			touchState.current.lastTouchY = touch.clientY;
			touchState.current.isPinching = false;
		} else if (e.touches.length === 2) {
			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const distance = Math.sqrt(
				Math.pow(t2.clientX - t1.clientX, 2) +
					Math.pow(t2.clientY - t1.clientY, 2),
			);
			touchState.current.lastTouchDistance = distance;
			touchState.current.isPinching = true;
			touchState.current.lastTouchX = (t1.clientX + t2.clientX) / 2;
			touchState.current.lastTouchY = (t1.clientY + t2.clientY) / 2;
		}
	}, []);

	const handleTouchMove = useCallback((e: React.TouchEvent) => {
		if (e.touches.length === 1 && !touchState.current.isPinching) {
			const touch = e.touches[0];
			const panX = touch.clientX - touchState.current.lastTouchX;
			const panY = touch.clientY - touchState.current.lastTouchY;
			setPan((p) => ({ x: p.x + panX, y: p.y + panY }));
			touchState.current.lastTouchX = touch.clientX;
			touchState.current.lastTouchY = touch.clientY;
		} else if (e.touches.length === 2 && touchState.current.isPinching) {
			e.preventDefault();
			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const distance = Math.sqrt(
				Math.pow(t2.clientX - t1.clientX, 2) +
					Math.pow(t2.clientY - t1.clientY, 2),
			);

			const scaleDelta =
				(distance - touchState.current.lastTouchDistance) * 0.005;
			setScale((s) => Math.max(0.5, Math.min(2, s + scaleDelta)));

			const centerX = (t1.clientX + t2.clientX) / 2;
			const centerY = (t1.clientY + t2.clientY) / 2;
			const panX = centerX - touchState.current.lastTouchX;
			const panY = centerY - touchState.current.lastTouchY;
			setPan((p) => ({ x: p.x + panX, y: p.y + panY }));

			touchState.current.lastTouchDistance = distance;
			touchState.current.lastTouchX = centerX;
			touchState.current.lastTouchY = centerY;
		}
	}, []);

	const handleTouchEnd = useCallback(() => {
		touchState.current.isPinching = false;
		touchState.current.lastTouchDistance = 0;
		setIsDragging(false);
	}, []);

	const handleWheel = useCallback((e: React.WheelEvent) => {
		e.preventDefault();
		const delta = e.deltaY > 0 ? -0.1 : 0.1;
		setScale((s) => Math.max(0.5, Math.min(2, s + delta)));
	}, []);

	const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 2));
	const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
	const handleReset = () => {
		setScale(1);
		setPan({ x: 0, y: 0 });
	};

	return (
		<div className="relative rounded border border-[#e0dcd3] bg-[#faf9f6] overflow-hidden">
			<div className="absolute top-3 right-3 z-10 flex gap-2">
				<button
					type="button"
					onClick={handleZoomOut}
					className="p-2 bg-white rounded transition-all text-[#6b6560] hover:text-[#c8951e]"
					title="缩小"
				>
					<ZoomOut size={16} />
				</button>
				<button
					type="button"
					onClick={handleZoomIn}
					className="p-2 bg-white rounded transition-all text-[#6b6560] hover:text-[#c8951e]"
					title="放大"
				>
					<ZoomIn size={16} />
				</button>
				<button
					type="button"
					onClick={handleReset}
					className="p-2 bg-white rounded transition-all text-[#6b6560] hover:text-[#c8951e]"
					title="重置"
				>
					<Maximize size={16} />
				</button>
			</div>

			<svg
				ref={svgRef}
				width="100%"
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				preserveAspectRatio="xMidYMid meet"
				className="w-full cursor-grab active:cursor-grabbing touch-none"
				role="img"
				aria-label="Wiki 关联预览图谱"
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				onWheel={handleWheel}
			>
				<defs>
					{Object.entries(RELATION_TYPE_LABELS).map(([type]) => (
						<marker
							key={type}
							id={`mini-relation-arrow-${type}`}
							viewBox="0 0 10 10"
							refX="9"
							refY="5"
							markerWidth="6"
							markerHeight="6"
							orient="auto-start-reverse"
						>
							<path
								d="M 0 0 L 10 5 L 0 10 z"
								fill={
									RELATION_GRAPH_TYPE_COLORS[
										type as WikiRelationRecord["type"]
									]
								}
							/>
						</marker>
					))}
				</defs>

				{graph.edges.map((edge, idx) => {
					const source = nodeBySlug.get(edge.sourceSlug);
					const target = nodeBySlug.get(edge.targetSlug);
					if (!source || !target) return null;

					const edgeColor = getRelationGraphEdgeColor(edge.type);
					const edgeLabel = truncateGraphLabel(
						getRelationGraphEdgeLabel(edge),
						10,
					);
					const midX = (source.x + target.x) / 2;
					const midY = (source.y + target.y) / 2;

					return (
						<g key={`${edge.sourceSlug}-${edge.targetSlug}-${edge.type}-${idx}`}>
							<title>{getRelationGraphEdgeLabel(edge)}</title>
							<line
								x1={source.x}
								y1={source.y}
								x2={target.x}
								y2={target.y}
								stroke={edgeColor}
								strokeWidth={2}
								strokeOpacity={0.68}
								strokeDasharray={edge.inferred ? "4 4" : undefined}
								markerEnd={`url(#mini-relation-arrow-${edge.type})`}
							/>
							<text
								x={midX}
								y={midY - 4}
								textAnchor="middle"
								fill={edgeColor}
								fontSize="10"
								fontWeight={600}
								style={{ textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}
							>
								{edgeLabel}
							</text>
						</g>
					);
				})}

				{nodes.map((node) => {
					const nodeStyle = getRelationGraphNodeStyle(node);
					const canClick =
						Boolean(onNodeClick) &&
						isRelationGraphNodeClickable(node.slug, currentSlug);

					return (
						<g
							key={node.slug}
							transform={`translate(${node.x}, ${node.y})`}
							className={`transition-all ${canClick ? "cursor-pointer hover:opacity-80" : ""}`}
							onClick={() => {
								if (canClick) {
									onNodeClick?.(node.slug);
								}
							}}
						>
							<title>{node.title}</title>
							<circle
								r={nodeStyle.size}
								fill={nodeStyle.background}
								stroke={nodeStyle.border}
								strokeWidth={nodeStyle.borderWidth}
								filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))"
							/>
							<text
								x={0}
								y={0}
								textAnchor="middle"
								dominantBaseline="middle"
								fill={nodeStyle.fontColor}
								fontSize={nodeStyle.fontSize}
								fontWeight={700}
								style={{
									textShadow: node.isCenter
										? "0 1px 2px rgba(0,0,0,0.2)"
										: "none",
								}}
							>
								{truncateGraphLabel(node.title, nodeStyle.labelLength)}
							</text>
						</g>
					);
				})}
			</svg>

			<div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
				{Object.entries(RELATION_TYPE_LABELS).map(([type, label]) => {
					const color =
						RELATION_GRAPH_TYPE_COLORS[type as WikiRelationRecord["type"]];
					return (
						<div
							key={type}
							className="flex items-center gap-1.5 px-2 py-1 bg-white/90 rounded text-[10px]"
						>
							<div
								className="w-2 h-2 rounded-full"
								style={{ backgroundColor: color }}
							/>
							<span className="text-[#6b6560]">{label}</span>
						</div>
					);
				})}
			</div>

			<div className="absolute bottom-3 right-3 z-10 px-3 py-2 bg-white/90 rounded text-[10px] text-[#6b6560]">
				<span className="font-bold">{nodes.length}</span> 个节点 ·{" "}
				<span className="font-bold">{graph.edges.length}</span> 条关联
			</div>
		</div>
	);
};

export default MiniRelationGraph;
