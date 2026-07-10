import { useState } from 'react';
import OutletList from './outlet-list';
import OutletDetail from './outlet-detail';
import type { OtherOutlet, OutletData, OutletPriceRow } from './types';

export function OutletTab({ outlets, selectedOutlet, outletPrices, otherOutlets }: {
    outlets?: OutletData[];
    selectedOutlet?: { id: number; name: string };
    outletPrices?: OutletPriceRow[];
    otherOutlets?: OtherOutlet[];
}) {
    const [selectedId, setSelectedId] = useState<number | null>(selectedOutlet?.id ?? null);

    if (!outlets || outlets.length === 0) {
        return (
            <div className="rounded-lg border border-border bg-white p-12 text-center">
                <p className="text-sm text-text-muted">Belum ada outlet aktif.</p>
            </div>
        );
    }

    const selectedOutletData = outlets.find((o) => o.id === selectedId);

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
            {/* Panel Kiri — Outlet List */}
            <div className="rounded-lg border border-border bg-white p-3 lg:max-h-[calc(100vh-14rem)]">
                <OutletList
                    outlets={outlets}
                    selectedId={selectedId}
                    onSelect={(id) => {
                        setSelectedId(id);
                    }}
                />
            </div>

            {/* Panel Kanan — Outlet Detail */}
            <div>
                {selectedId && selectedOutletData ? (
                    <OutletDetail
                        outlet={{ id: selectedId, name: selectedOutletData.name }}
                        prices={outletPrices}
                        otherOutlets={otherOutlets}
                        allOutlets={outlets}
                    />
                ) : (
                    <div className="rounded-lg border border-dashed border-border bg-white p-12 text-center">
                        <p className="text-sm text-text-muted">Pilih outlet di panel kiri untuk melihat detail harga.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
