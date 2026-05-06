import type { WikiPageMetadata } from "./wikiLinkParser";
import {
	RELATION_TYPE_LABELS,
	type WikiRelationType,
} from "./relationConstants";

export type RelationGraphNode = {
	slug: string;
	title: string;
	category: string;
	depth: 0 | 1 | 2;
	isCenter: boolean;
};

export type RelationGraphEdge = {
	sourceSlug: string;
	targetSlug: string;
	type: WikiRelationType;
	typeLabel: string;
	label: string | null;
	inferred: boolean;
};

export type RelationGraphData = {
	nodes: RelationGraphNode[];
	edges: RelationGraphEdge[];
};

export type RelationGraphNodePosition = RelationGraphNode & {
	x: number;
	y: number;
};

export type MiniRelationGraphRelation = {
	type: WikiRelationType;
	targetSlug: string;
	label?: string | null;
};

type Point = {
	x: number;
	y: number;
};

export const RELATION_GRAPH_TYPE_COLORS: Record<WikiRelationType, string> = {
	related_person: "#6B8E23",
	work_relation: "#CD853F",
	timeline_relation: "#4682B4",
	custom: "#9370DB",
};

type RelationGraphNodeStyle = {
	background: string;
	border: string;
	highlightBackground: string;
	highlightBorder: string;
	fontColor: string;
	fontSize: number;
	size: number;
	borderWidth: number;
	labelLength: number;
};

const CENTER_NODE_STYLE: RelationGraphNodeStyle = {
	background: "#6B8E23",
	border: "#556B2F",
	highlightBackground: "#8FBC8F",
	highlightBorder: "#6B8E23",
	fontColor: "#ffffff",
	fontSize: 16,
	size: 34,
	borderWidth: 3,
	labelLength: 10,
};

const FIRST_LAYER_NODE_STYLE: RelationGraphNodeStyle = {
	background: "#F4A460",
	border: "#D2B48C",
	highlightBackground: "#FFA07A",
	highlightBorder: "#DAA520",
	fontColor: "#2F2F2F",
	fontSize: 14,
	size: 26,
	borderWidth: 2,
	labelLength: 10,
};

const SECOND_LAYER_NODE_STYLE: RelationGraphNodeStyle = {
	background: "#DEB887",
	border: "#D2B48C",
	highlightBackground: "#E6C89C",
	highlightBorder: "#DAA520",
	fontColor: "#2F2F2F",
	fontSize: 13,
	size: 22,
	borderWidth: 2,
	labelLength: 9,
};

export const RELATION_GRAPH_DEPTH_RADII: Record<1 | 2, number> = {
	1: 120,
	2: 220,
};

export function truncateGraphLabel(label: string, maxLength: number): string {
	return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;
}

export function getRelationGraphNodeStyle(
	node: Pick<RelationGraphNode, "depth" | "isCenter">,
): RelationGraphNodeStyle {
	if (node.isCenter || node.depth === 0) return CENTER_NODE_STYLE;
	if (node.depth === 1) return FIRST_LAYER_NODE_STYLE;
	return SECOND_LAYER_NODE_STYLE;
}

export function getRelationGraphEdgeColor(type: WikiRelationType): string {
	return RELATION_GRAPH_TYPE_COLORS[type];
}

export function getRelationGraphEdgeLabel(
	edge: Pick<RelationGraphEdge, "label" | "type" | "typeLabel">,
): string {
	const label = edge.label?.trim();
	return label || edge.typeLabel || RELATION_TYPE_LABELS[edge.type];
}

export function isRelationGraphNodeClickable(
	slug: string,
	currentSlug: string,
): boolean {
	return slug !== currentSlug;
}

export function buildMiniRelationGraphData({
	relations,
	metadata,
	currentSlug,
	currentTitle,
}: {
	relations: MiniRelationGraphRelation[];
	metadata: Map<string, WikiPageMetadata>;
	currentSlug: string;
	currentTitle: string;
}): RelationGraphData {
	const nodes = new Map<string, RelationGraphNode>();
	const edges: RelationGraphEdge[] = [];

	nodes.set(currentSlug, {
		slug: currentSlug,
		title: currentTitle,
		category: "",
		depth: 0,
		isCenter: true,
	});

	relations.forEach((relation) => {
		const targetMeta = metadata.get(relation.targetSlug);
		const targetTitle =
			targetMeta?.title?.trim() || relation.label?.trim() || relation.targetSlug;

		if (!nodes.has(relation.targetSlug)) {
			nodes.set(relation.targetSlug, {
				slug: relation.targetSlug,
				title: targetTitle,
				category: targetMeta?.category || "",
				depth: 1,
				isCenter: false,
			});
		}

		edges.push({
			sourceSlug: currentSlug,
			targetSlug: relation.targetSlug,
			type: relation.type,
			typeLabel: RELATION_TYPE_LABELS[relation.type],
			label: relation.label?.trim() || null,
			inferred: false,
		});
	});

	return {
		nodes: Array.from(nodes.values()),
		edges,
	};
}

export function layoutRelationGraphRadial(
	graph: RelationGraphData,
	{
		width,
		height,
		scale = 1,
		pan = { x: 0, y: 0 },
		depthRadii = RELATION_GRAPH_DEPTH_RADII,
	}: {
		width: number;
		height: number;
		scale?: number;
		pan?: Point;
		depthRadii?: Record<1 | 2, number>;
	},
): RelationGraphNodePosition[] {
	const center = {
		x: width / 2 + pan.x,
		y: height / 2 + pan.y,
	};

	const groups = new Map<0 | 1 | 2, RelationGraphNode[]>();
	graph.nodes.forEach((node) => {
		const depth = node.isCenter ? 0 : node.depth;
		const depthNodes = groups.get(depth) || [];
		depthNodes.push(node);
		groups.set(depth, depthNodes);
	});

	const positioned: RelationGraphNodePosition[] = [];
	const centerNodes = groups.get(0) || [];
	centerNodes.forEach((node) => positioned.push({ ...node, ...center }));

	([1, 2] as const).forEach((depth) => {
		const depthNodes = groups.get(depth) || [];
		const radius = depthRadii[depth] * scale;

		depthNodes.forEach((node, index) => {
			const angle = (2 * Math.PI * index) / depthNodes.length - Math.PI / 2;
			positioned.push({
				...node,
				x: center.x + radius * Math.cos(angle),
				y: center.y + radius * Math.sin(angle),
			});
		});
	});

	return positioned;
}
