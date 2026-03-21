export type DrawingTool =
  | 'hline' | 'vline' | 'trendline' | 'rectangle'
  | 'fibonacci' | 'longpos' | 'shortpos' | 'brush' | 'path' | null

export interface DrawPoint { price: number; time: number }

export type Drawing =
  | { id: string; type: 'hline';      price: number; color: string }
  | { id: string; type: 'vline';      time: number;  color: string }
  | { id: string; type: 'trendline';  p1: DrawPoint; p2: DrawPoint; color: string }
  | { id: string; type: 'rectangle';  p1: DrawPoint; p2: DrawPoint; color: string }
  | { id: string; type: 'fibonacci';  p1: DrawPoint; p2: DrawPoint; color: string }
  | { id: string; type: 'longpos';    p1: DrawPoint; p2: DrawPoint; color: string }
  | { id: string; type: 'shortpos';   p1: DrawPoint; p2: DrawPoint; color: string }
  | { id: string; type: 'brush';      points: DrawPoint[];           color: string }

export const TOOL_LABELS: Record<NonNullable<DrawingTool>, string> = {
  hline:      '─',
  vline:      '│',
  trendline:  '╱',
  rectangle:  '▭',
  fibonacci:  'Fib',
  longpos:    '↑L',
  shortpos:   '↓S',
  brush:      '✏',
  path:       '〜',
}

export const TOOL_TITLES: Record<NonNullable<DrawingTool>, string> = {
  hline:      'Horizontal Line',
  vline:      'Vertical Line',
  trendline:  'Trend Line',
  rectangle:  'Rectangle',
  fibonacci:  'Fibonacci Retracement',
  longpos:    'Long Position',
  shortpos:   'Short Position',
  brush:      'Brush',
  path:       'Path',
}

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
export const FIB_COLORS = ['#f59e0b','#a78bfa','#60a5fa','#34d399','#60a5fa','#a78bfa','#f59e0b']

export function uid() {
  return Math.random().toString(36).slice(2, 9)
}
