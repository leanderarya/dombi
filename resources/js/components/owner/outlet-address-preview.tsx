export default function OutletAddressPreview({ data, geocodingState }: { data: any; geocodingState?: string }) {
    const coordinatesReady = data.latitude && data.longitude;

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-slate-900">Auto Detected Address</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Alamat terdeteksi otomatis dari lokasi peta. Silakan periksa kembali sebelum menyimpan.</p>
                </div>
                {geocodingState === 'loading' && <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">Detecting</span>}
                {geocodingState === 'failed' && <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Review</span>}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <Info label="Kelurahan" value={data.kelurahan} />
                <Info label="Kecamatan" value={data.kecamatan} />
                <Info label="Kota/Kabupaten" value={data.city} />
                <Info label="Provinsi" value={data.province} />
                <Info label="Postal Code" value={data.postal_code} />
                <Info label="Coordinates" value={coordinatesReady ? `${Number(data.latitude).toFixed(5)}, ${Number(data.longitude).toFixed(5)}` : '-'} />
            </div>
        </section>
    );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 min-h-4 truncate text-xs font-semibold text-slate-900 tabular-nums">{value || '-'}</div>
        </div>
    );
}
