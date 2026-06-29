import {
  EChartsComponent,
  chartPalette,
  chartTheme,
  defaultTooltipSettings,
} from './EChartsComponent'
import type { EChartsOption } from 'echarts'

interface ContentDistributionChartProps {
  data: { name: string; value: number }[]
  style?: React.CSSProperties
  className?: string
}

export const ContentDistributionChart: React.FC<ContentDistributionChartProps> = ({
  data,
  style,
  className,
}) => {
  const option: EChartsOption = {
    color: chartTheme.color,
    tooltip: {
      ...defaultTooltipSettings,
      trigger: 'item' as const,
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: '10%',
      top: 'center',
      textStyle: {
        color: chartPalette.label,
        fontFamily: 'Noto Sans SC, sans-serif',
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: chartPalette.white,
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
            fontFamily: 'Noto Sans SC, sans-serif',
          },
        },
        labelLine: {
          show: false,
        },
        data: data.map((item, index) => ({
          ...item,
          itemStyle: {
            color: chartTheme.color[index % chartTheme.color.length],
          },
        })),
      },
    ],
  }

  return <EChartsComponent option={option} style={style} className={className} />
}
