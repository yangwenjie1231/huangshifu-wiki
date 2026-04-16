import React, { useEffect, useRef, useCallback } from 'react';
import { Network, DataSet } from 'vis-network/standalone';
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

const NODE_COLORS: Record<WikiRelationType, string> = {
  related_person: '#6B8E23',
  work_relation: '#CD853F',
  timeline_relation: '#4682B4',
  custom: '#9370DB',
};

const EDGE_COLORS: Record<WikiRelationType, string> = {
  related_person: '#6B8E23',
  work_relation: '#CD853F',
  timeline_relation: '#4682B4',
  custom: '#9370DB',
};

const RelationGraph = ({ graph, currentSlug, onNodeClick }: RelationGraphProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  const handleClick = useCallback((slug: string) => {
    if (slug !== currentSlug && onNodeClick) {
      onNodeClick(slug);
    }
  }, [currentSlug, onNodeClick]);

  useEffect(() => {
    if (!containerRef.current || !graph.nodes.length) return;

    const nodes = new DataSet(
      graph.nodes.map((node) => {
        const isCenter = node.slug === currentSlug || node.isCenter;
        const baseColor = isCenter ? '#6B8E23' : node.depth === 1 ? '#F4A460' : '#DEB887';
        
        return {
          id: node.slug,
          label: node.title.length > 12 ? node.title.slice(0, 12) + '...' : node.title,
          title: node.title,
          color: {
            background: baseColor,
            border: isCenter ? '#556B2F' : '#D2B48C',
            highlight: {
              background: isCenter ? '#8FBC8F' : node.depth === 1 ? '#FFA07A' : '#E6C89C',
              border: isCenter ? '#6B8E23' : '#DAA520',
            },
          },
          shape: 'dot',
          size: isCenter ? 40 : node.depth === 1 ? 30 : 25,
          font: {
            color: isCenter ? '#ffffff' : '#2F2F2F',
            size: isCenter ? 16 : 14,
            face: 'serif',
            strokeWidth: 0,
          },
          shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.2)',
            size: 10,
            x: 0,
            y: 0,
          },
          borderWidth: isCenter ? 3 : 2,
          fixed: isCenter,
        };
      })
    );

    const edges = new DataSet(
      graph.edges.map((edge) => {
        const edgeColor = EDGE_COLORS[edge.type] || '#7b8a70';
        
        return {
          id: `${edge.sourceSlug}-${edge.targetSlug}-${edge.type}-${edge.label || 'none'}`,
          from: edge.sourceSlug,
          to: edge.targetSlug,
          label: edge.label || edge.typeLabel,
          color: {
            color: edgeColor,
            highlight: edgeColor,
          },
          dashes: edge.inferred,
          arrows: 'to',
          font: {
            color: edgeColor,
            size: 12,
            face: 'sans',
            strokeWidth: 2,
            strokeColor: '#ffffff',
            align: 'middle',
          },
          smooth: {
            enabled: true,
            type: 'continuous',
            roundness: 0,
          },
          shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.1)',
            size: 4,
          },
        };
      })
    );

    const options = {
      nodes: {
        shape: 'dot',
        scaling: {
          min: 20,
          max: 50,
        },
      },
      edges: {
        width: 2,
        smooth: {
          enabled: true,
          type: 'continuous',
          roundness: 0.5,
        },
      },
      layout: {
        randomSeed: 42,
      },
      physics: {
        enabled: true,
        barnesHut: {
          gravitationalConstant: -3000,
          centralGravity: 0.3,
          springLength: 150,
          springConstant: 0.04,
          damping: 0.09,
        },
        stabilization: {
          enabled: true,
          iterations: 150,
          updateInterval: 50,
        },
      },
      interaction: {
        hover: true,
        dragNodes: true,
        dragView: true,
        zoomView: true,
        keyboard: false,
        tooltipDelay: 200,
      },
      manipulation: false,
    };

    const network = new Network(containerRef.current, { nodes, edges }, options);
    networkRef.current = network;

    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string;
        handleClick(nodeId);
      }
    });

    network.on('hoverNode', () => {
      if (containerRef.current) {
        containerRef.current.style.cursor = 'pointer';
      }
    });

    network.on('blurNode', () => {
      if (containerRef.current) {
        containerRef.current.style.cursor = 'default';
      }
    });

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [graph, currentSlug, handleClick]);

  if (!graph.nodes.length) {
    return <div className="text-sm text-gray-500">暂无可展示的关系图谱。</div>;
  }

  return (
    <div className="rounded-3xl border border-brand-olive/20 bg-gradient-to-br from-brand-cream/30 to-white p-6 sm:p-8 shadow-sm">
      <div
        ref={containerRef}
        className="w-full h-[400px] sm:h-[500px]"
        role="img"
        aria-label="Wiki 关系图谱"
      />

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
