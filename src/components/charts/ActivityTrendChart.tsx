import {
  EChartsComponent,
  chartPalette,
  chartTheme,
  defaultGridSettings,
  defaultTooltipSettings,
} from './EChartsComponent'
import type { EChartsOption } from 'echarts'

interface ActivityTrendChartProps {
  data: { date: string; value: number }[]
  style?: React.CSSProperties
  className?: string
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
        type: 'line',
        data: data.map((item) => item.value),
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          color: chartPalette.linePrimary,
          width: 3,
        },
        itemStyle: {
          color: chartPalette.linePrimary,
          borderColor: chartPalette.white,
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
              { offset: 0, color: chartPalette.linePrimarySoft },
              { offset: 1, color: chartPalette.linePrimarySoftEnd },
            ],
          },
        },
      },
    ],
  }

  return <EChartsComponent option={option} style={style} className={className} />
}
