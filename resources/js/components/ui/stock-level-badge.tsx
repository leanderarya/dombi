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
    success: 'bg-success-bg text-success-text',
    warning: 'bg-warning-bg text-warning-text',
    danger: 'bg-danger-bg text-danger-text',
  };
  
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[variant]}`}>
      {displayLabel}
    </span>
  );
}
