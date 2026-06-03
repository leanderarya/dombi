import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

type LatLng = { lat: number; lng: number };

const INDONESIA_CENTER: LatLng = { lat: -2.5489, lng: 118.0149 };

export default function OutletLocationMap({ value, onChange, readOnly = false }: { value?: LatLng | null; onChange: (value: LatLng) => void; readOnly?: boolean }) {
    const marker = value?.lat && value?.lng ? value : null;
    const center = marker ?? { lat: -7.0051, lng: 110.4381 };
    const selectedIcon = useMemo(() => L.icon({
        iconRetinaUrl: markerIcon2x,
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    }), []);

    return (
        <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-100">
            <div className="h-[280px] w-full">
                <MapContainer center={center} zoom={marker ? 15 : 5} className="h-full w-full" scrollWheelZoom={false} zoomControl={false} touchZoom>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapCenter position={center} zoom={marker ? 15 : 5} />
                    {!readOnly && <MapClickHandler onChange={onChange} />}
                    {marker && (
                        <Marker
                            position={marker}
                            icon={selectedIcon}
                            draggable={!readOnly}
                            eventHandlers={{
                                dragend: (event) => {
                                    const point = event.target.getLatLng();
                                    onChange({ lat: point.lat, lng: point.lng });
                                },
                            }}
                        />
                    )}
                </MapContainer>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 py-2 text-[11px]">
                <span className="font-semibold text-slate-500">{readOnly ? 'Outlet coordinates' : 'Tap map atau drag marker'}</span>
                <span className="rounded-md bg-[#F8FAFC] px-2 py-1 font-semibold text-slate-700 tabular-nums">
                    Lat: {marker ? marker.lat.toFixed(5) : INDONESIA_CENTER.lat.toFixed(2)} · Lng: {marker ? marker.lng.toFixed(5) : INDONESIA_CENTER.lng.toFixed(2)}
                </span>
            </div>
        </div>
    );
}

function MapClickHandler({ onChange }: { onChange: (value: LatLng) => void }) {
    useMapEvents({
        click(event) {
            onChange({ lat: event.latlng.lat, lng: event.latlng.lng });
        },
    });

    return null;
}

function MapCenter({ position, zoom }: { position: LatLng; zoom: number }) {
    const map = useMap();

    useEffect(() => {
        map.setView(position, zoom, { animate: true });
    }, [map, position.lat, position.lng, zoom]);

    return null;
}
