import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

echarts.use([
  BarChart,
  PieChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

interface EChartsComponentProps {
  option: EChartsOption;
  style?: React.CSSProperties;
  className?: string;
  onChartReady?: (chart: echarts.ECharts) => void;
}

export const EChartsComponent: React.FC<EChartsComponentProps> = ({
  option,
  style,
  className,
  onChartReady,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstanceRef.current = echarts.init(chartRef.current);

    if (onChartReady) {
      onChartReady(chartInstanceRef.current);
    }

    const handleResize = () => {
      chartInstanceRef.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstanceRef.current?.dispose();
    };
  }, [onChartReady]);

  useEffect(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.setOption(option);
    }
  }, [option]);

  return <div ref={chartRef} style={style} className={className} />;
};

export const chartTheme = {
  color: ['#FFD700', '#5A5A40', '#22C55E', '#007AFF', '#5856D6'],
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: 'Noto Sans SC, sans-serif',
  },
};

export const defaultGridSettings = {
  left: '10%',
  right: '10%',
  top: '15%',
  bottom: '15%',
  containLabel: true,
};

export const defaultTooltipSettings = {
  trigger: 'axis' as const,
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderColor: '#E5DED1',
  borderWidth: 1,
  textStyle: {
    color: '#111827',
    fontFamily: 'Noto Sans SC, sans-serif',
  },
};
