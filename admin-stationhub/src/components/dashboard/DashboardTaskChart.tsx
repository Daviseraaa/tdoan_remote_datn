import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type TaskChartPoint = {
  time: string;
  success: number;
  failure: number;
};

type Props = {
  data: TaskChartPoint[];
};

export default function DashboardTaskChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a4e6ff" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#a4e6ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
        <XAxis
          dataKey="time"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#bbc9cf', fontSize: 10, fontWeight: 500 }}
          dy={10}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            backgroundColor: '#171f33',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '12px',
          }}
        />
        <Area
          type="monotone"
          dataKey="success"
          stroke="#a4e6ff"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorSuccess)"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="failure"
          stroke="#ffb4ab"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
