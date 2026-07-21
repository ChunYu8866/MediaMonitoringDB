import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTheme } from '../lib/theme';

interface Props {
  option: EChartsOption;
  height?: number | string;
  /** 無資料時顯示的替代內容。 */
  className?: string;
}

/** 統一的 ECharts 容器：自動處理主題重繪與 RWD 尺寸。 */
export function Chart({ option, height = 300, className }: Props) {
  const { resolved } = useTheme();
  return (
    <ReactECharts
      // 主題切換時以 key 強制重新初始化，確保座標軸與文字顏色更新
      key={resolved}
      option={option}
      notMerge
      lazyUpdate
      style={{ height, width: '100%' }}
      className={className}
      opts={{ renderer: 'canvas' }}
    />
  );
}
