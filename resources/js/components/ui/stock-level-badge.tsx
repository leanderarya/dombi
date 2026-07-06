import { getOwnerStockStatus, type StockStatus } from '@/lib/status-labels';

export default function StockLevelBadge({ 
  status, 
  availableStock,
  showQuantity = false 
}: { 
  status: StockStatus;
  availableStock?: number;
  showQuantity?: boolean;
}) {
  const { displayLabel, variant } = getOwnerStockStatus(status, showQuantity ? availableStock : undefined);
  
  const styles: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
  };
  
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${styles[variant]}`}>
      {displayLabel}
    </span>
  );
}
