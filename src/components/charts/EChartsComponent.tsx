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
import { CHART_COLOR_TOKENS } from '../../lib/colorTokens';

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

export const chartPalette = CHART_COLOR_TOKENS;

export const chartTheme = {
  color: [
  chartPalette.series.brandGold,
  chartPalette.series.brandOlive,
  chartPalette.series.success,
  chartPalette.series.info,
  chartPalette.series.accent,
  ],
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
  backgroundColor: chartPalette.tooltipBackground,
  borderColor: chartPalette.tooltipBorder,
  borderWidth: 1,
  textStyle: {
    color: chartPalette.tooltipText,
    fontFamily: 'Noto Sans SC, sans-serif',
  },
};
