import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import type { SeriesOption } from 'echarts';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

export { echarts };
export type ECharts = EChartsType;
export type EChartsOption = EChartsCoreOption;
export type { SeriesOption };
export type LinearGradient = InstanceType<typeof echarts.graphic.LinearGradient>;
