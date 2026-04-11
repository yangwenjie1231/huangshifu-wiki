import { EChartsComponent, chartTheme, defaultGridSettings, defaultTooltipSettings } from './EChartsComponent';
import type { EChartsOption } from 'echarts';

interface ActivityTrendChartProps {
  data: { date: string; value: number }[];
  style?: React.CSSProperties;
  className?: string;
}

export const ActivityTrendChart: React.FC<ActivityTrendChartProps> = ({
  data,
  style,
  className,
}) => {
  const option: EChartsOption = {
    color: chartTheme.color,
    tooltip: {
      ...defaultTooltipSettings,
    },
    grid: defaultGridSettings,
    xAxis: {
      type: 'category',
      data: data.map((item) => item.date),
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: '#E5DED1',
        },
      },
      axisLabel: {
        color: '#6B7280',
        fontFamily: 'Noto Sans SC, sans-serif',
      },
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: '#6B7280',
        fontFamily: 'Noto Sans SC, sans-serif',
      },
      splitLine: {
        lineStyle: {
          color: '#F5F5F5',
        },
      },
    },
    series: [
      {
        type: 'line',
        data: data.map((item) => item.value),
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          color: '#007AFF',
          width: 3,
        },
        itemStyle: {
          color: '#007AFF',
          borderColor: '#fff',
          borderWidth: 2,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 122, 255, 0.3)' },
              { offset: 1, color: 'rgba(0, 122, 255, 0.05)' },
            ],
          },
        },
      },
    ],
  };

  return <EChartsComponent option={option} style={style} className={className} />;
};
