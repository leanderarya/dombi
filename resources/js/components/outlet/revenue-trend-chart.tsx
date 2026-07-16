import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { formatCurrency } from '@/lib/format';

interface DailyRevenue {
  date: string;
  revenue: number;
}

interface RevenueTrendChartProps {
  data: DailyRevenue[];
}

function formatYAxisTick(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}Jt`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return `${value}`;
}

function formatXAxisTick(value: string): string {
  const parts = value.split('-');
  return `${String(parseInt(parts[2], 10)).padStart(2, '0')}/${parseInt(parts[1], 10)}`;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: DailyRevenue }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const date = new Date(label ?? '');
  const formattedDate = date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-sm">
      <p className="text-text-muted">{formattedDate}</p>
      <p className="font-semibold text-foreground">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

export default function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-4">
        Belum ada data penjualan
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#059669" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={formatXAxisTick}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={formatYAxisTick}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          width={45}
        />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="revenue"
          fill="url(#revenueGradient)"
          stroke="none"
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#059669"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#059669', stroke: '#fff', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
