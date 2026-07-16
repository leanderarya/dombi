import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/format';

interface TopProduct {
  product_name: string;
  total_qty: number;
  total_revenue: number;
}

interface TopProductsChartProps {
  data: TopProduct[];
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: TopProduct }>;
}

function truncateName(name: string, max = 17): string {
  if (name.length <= max) return name;
  return name.slice(0, max) + '…';
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const { product_name, total_qty, total_revenue } = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-foreground">{product_name}</p>
      <p className="mt-1 text-text-muted">
        {total_qty} unit &mdash; {formatCurrency(total_revenue)}
      </p>
    </div>
  );
}

export default function TopProductsChart({ data }: TopProductsChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-4">
        Belum ada data penjualan
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="product_name"
          tickFormatter={truncateName}
          tick={{ fontSize: 11, fill: '#374151' }}
          tickLine={false}
          axisLine={false}
          width={130}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar
          dataKey="total_qty"
          fill="#059669"
          radius={[0, 4, 4, 0]}
          barSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
