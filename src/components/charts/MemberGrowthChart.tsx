import {
  EChartsComponent,
  chartPalette,
  chartTheme,
  defaultGridSettings,
  defaultTooltipSettings,
} from './EChartsComponent'
import type { EChartsOption } from 'echarts'

interface MemberGrowthChartProps {
  data: { month: string; count: number }[]
  style?: React.CSSProperties
  className?: string
}

export const MemberGrowthChart: React.FC<MemberGrowthChartProps> = ({ data, style, className }) => {
  const option: EChartsOption = {
    color: chartTheme.color,
    tooltip: {
      ...defaultTooltipSettings,
    },
    grid: defaultGridSettings,
    xAxis: {
      type: 'category',
      data: data.map((item) => item.month),
      axisLine: {
        lineStyle: {
          color: chartPalette.axis,
        },
      },
      axisLabel: {
        color: chartPalette.label,
        fontFamily: 'Noto Sans SC, sans-serif',
      },
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: chartPalette.label,
        fontFamily: 'Noto Sans SC, sans-serif',
      },
      splitLine: {
        lineStyle: {
          color: chartPalette.splitLine,
        },
      },
    },
    series: [
      {
        type: 'bar',
        data: data.map((item) => item.count),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: chartPalette.barStart },
              { offset: 1, color: chartPalette.barEnd },
            ],
          },
          borderRadius: [8, 8, 0, 0],
        },
        barWidth: '40%',
      },
    ],
  }

  return <EChartsComponent option={option} style={style} className={className} />
}
