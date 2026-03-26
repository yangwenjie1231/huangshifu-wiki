import React, { useMemo } from 'react';
import { clsx } from 'clsx';

export type WikiRelationType = 'related_person' | 'work_relation' | 'timeline_relation' | 'custom';

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

type RelationGraphProps = {
  graph: RelationGraphData;
  currentSlug: string;
  onNodeClick?: (slug: string) => void;
};

const EDGE_COLORS: Record<WikiRelationType, string> = {
  related_person: '#5f6f52',
  work_relation: '#8b5e3c',
  timeline_relation: '#4c6a92',
  custom: '#6f5f7a',
};

function shortenLabel(value: string, max = 11) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function ringPosition(index: number, total: number, radius: number, cx: number, cy: number, offset = -Math.PI / 2) {
  if (!total) {
    return { x: cx, y: cy };
  }

  const angle = offset + (Math.PI * 2 * index) / total;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

const RelationGraph = ({ graph, currentSlug, onNodeClick }: RelationGraphProps) => {
  const width = 980;
  const height = 600;
  const centerX = width / 2;
  const centerY = height / 2;

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();

    const centerNode = graph.nodes.find((node) => node.slug === currentSlug) || graph.nodes.find((node) => node.isCenter);
    if (!centerNode) {
      return map;
    }

    map.set(centerNode.slug, { x: centerX, y: centerY });

    const layerOne = graph.nodes
      .filter((node) => node.depth === 1)
      .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    const layerTwo = graph.nodes
      .filter((node) => node.depth === 2)
      .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));

    layerOne.forEach((node, index) => {
      map.set(node.slug, ringPosition(index, layerOne.length, 170, centerX, centerY));
    });

    layerTwo.forEach((node, index) => {
      map.set(node.slug, ringPosition(index, layerTwo.length, 270, centerX, centerY, -Math.PI / 3));
    });

    return map;
  }, [graph.nodes, currentSlug]);

  if (!graph.nodes.length) {
    return <div className="text-sm text-gray-500">暂无可展示的关系图谱。</div>;
  }

  return (
    <div className="rounded-3xl border border-brand-cream bg-brand-cream/20 p-4 sm:p-6">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[360px] sm:h-[460px]" role="img" aria-label="Wiki 关系图谱">
        <defs>
          <marker id="wiki-relation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#7b8a70" />
          </marker>
        </defs>

        {graph.edges.map((edge) => {
          const from = positions.get(edge.sourceSlug);
          const to = positions.get(edge.targetSlug);
          if (!from || !to) return null;

          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          const edgeColor = EDGE_COLORS[edge.type] || '#7b8a70';

          return (
            <g key={`${edge.sourceSlug}-${edge.targetSlug}-${edge.type}-${edge.label || 'none'}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={edgeColor}
                strokeWidth={edge.inferred ? 1.8 : 2.6}
                strokeDasharray={edge.inferred ? '6 5' : undefined}
                markerEnd="url(#wiki-relation-arrow)"
                opacity={0.88}
              />
              <text
                x={midX}
                y={midY - 4}
                textAnchor="middle"
                fill={edgeColor}
                fontSize="12"
                fontWeight={700}
              >
                {shortenLabel(edge.label || edge.typeLabel, 12)}
              </text>
            </g>
          );
        })}

        {graph.nodes.map((node) => {
          const point = positions.get(node.slug);
          if (!point) return null;

          const isCenter = node.slug === currentSlug || node.isCenter;
          const radius = isCenter ? 34 : node.depth === 1 ? 26 : 22;

          return (
            <g
              key={node.slug}
              transform={`translate(${point.x}, ${point.y})`}
              className={clsx('transition-opacity', isCenter ? '' : 'hover:opacity-90')}
              onClick={() => {
                if (!isCenter && onNodeClick) {
                  onNodeClick(node.slug);
                }
              }}
              style={{ cursor: !isCenter && onNodeClick ? 'pointer' : 'default' }}
            >
              <circle
                r={radius}
                fill={isCenter ? '#5f6f52' : node.depth === 1 ? '#d7cfb5' : '#e9e3d1'}
                stroke={isCenter ? '#4f5f43' : '#c8bfa4'}
                strokeWidth={isCenter ? 2.5 : 1.6}
              />
              <text
                x={0}
                y={-2}
                textAnchor="middle"
                fill={isCenter ? '#ffffff' : '#4b4f42'}
                fontSize={isCenter ? '13' : '12'}
                fontWeight={700}
              >
                {shortenLabel(node.title, isCenter ? 10 : 9)}
              </text>
              <text
                x={0}
                y={13}
                textAnchor="middle"
                fill={isCenter ? '#f0f3ed' : '#6f7567'}
                fontSize="10"
              >
                {node.depth === 0 ? '当前页面' : `${node.depth}层`}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#5f6f52]" /> 相关人物</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#8b5e3c]" /> 作品关联</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#4c6a92]" /> 时间线关联</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#6f5f7a]" /> 自定义关系</span>
        <span className="text-gray-400">虚线表示反向推断关系</span>
      </div>
    </div>
  );
};

export default RelationGraph;
