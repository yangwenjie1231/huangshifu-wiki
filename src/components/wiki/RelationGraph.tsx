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
  related_person: '#6B8E23',
  work_relation: '#CD853F',
  timeline_relation: '#4682B4',
  custom: '#9370DB',
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
    <div className="rounded-3xl border border-brand-olive/20 bg-gradient-to-br from-brand-cream/30 to-white p-6 sm:p-8 shadow-sm">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[400px] sm:h-[500px]" role="img" aria-label="Wiki 关系图谱">
        <defs>
          <marker id="wiki-relation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#5f6f52" />
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
                strokeWidth={edge.inferred ? 2 : 3}
                strokeDasharray={edge.inferred ? '6 5' : undefined}
                markerEnd="url(#wiki-relation-arrow)"
                opacity={0.75}
              />
              <text
                x={midX}
                y={midY - 6}
                textAnchor="middle"
                fill={edgeColor}
                fontSize="13"
                fontWeight={600}
                style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}
              >
                {shortenLabel(edge.label || edge.typeLabel, 14)}
              </text>
            </g>
          );
        })}

        {graph.nodes.map((node) => {
          const point = positions.get(node.slug);
          if (!point) return null;

          const isCenter = node.slug === currentSlug || node.isCenter;
          const radius = isCenter ? 42 : node.depth === 1 ? 32 : 28;

          return (
            <g
              key={node.slug}
              transform={`translate(${point.x}, ${point.y})`}
              className={clsx('transition-all duration-300', isCenter ? '' : 'hover:opacity-80 hover:scale-105')}
              onClick={() => {
                if (!isCenter && onNodeClick) {
                  onNodeClick(node.slug);
                }
              }}
              style={{ cursor: !isCenter && onNodeClick ? 'pointer' : 'default' }}
            >
              <circle
                r={radius}
                fill={isCenter ? '#6B8E23' : node.depth === 1 ? '#F4A460' : '#DEB88B'}
                stroke={isCenter ? '#556B2F' : '#D2B48C'}
                strokeWidth={isCenter ? 3 : 2}
                filter={isCenter ? 'drop-shadow(0 2px 4px rgba(107, 142, 35, 0.3))' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'}
              />
              <text
                x={0}
                y={-4}
                textAnchor="middle"
                fill={isCenter ? '#ffffff' : '#2F2F2F'}
                fontSize={isCenter ? '15' : '14'}
                fontWeight={700}
                style={{ textShadow: isCenter ? '0 1px 2px rgba(0,0,0,0.2)' : 'none' }}
              >
                {shortenLabel(node.title, isCenter ? 12 : 11)}
              </text>
              <text
                x={0}
                y={16}
                textAnchor="middle"
                fill={isCenter ? '#F0F8FF' : '#5F5F5F'}
                fontSize="11"
                fontWeight={500}
              >
                {node.depth === 0 ? '当前页面' : `${node.depth}度关联`}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-cream/50 rounded-full">
          <span className="inline-block h-3 w-3 rounded-full bg-[#6B8E23] shadow-sm" />
          <span className="text-gray-700 font-medium">相关人物</span>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-cream/50 rounded-full">
          <span className="inline-block h-3 w-3 rounded-full bg-[#CD853F] shadow-sm" />
          <span className="text-gray-700 font-medium">作品关联</span>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-cream/50 rounded-full">
          <span className="inline-block h-3 w-3 rounded-full bg-[#4682B4] shadow-sm" />
          <span className="text-gray-700 font-medium">时间线关联</span>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-cream/50 rounded-full">
          <span className="inline-block h-3 w-3 rounded-full bg-[#9370DB] shadow-sm" />
          <span className="text-gray-700 font-medium">自定义关系</span>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100/50 rounded-full">
          <span className="text-gray-500 font-medium">虚线表示反向推断关系</span>
        </div>
      </div>
    </div>
  );
};

export default RelationGraph;
