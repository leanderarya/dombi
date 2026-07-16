export type ReverseGeocodeResult = {
    formatted_address: string;
    kelurahan: string;
    kecamatan: string;
    city: string;
    province: string;
    postal_code: string;
};

type NominatimResponse = {
    display_name?: string;
    lat?: string;
    lon?: string;
    importance?: number;
    address?: Record<string, string | undefined>;
};

export type ForwardGeocodeResult = ReverseGeocodeResult & {
    latitude: number;
    longitude: number;
};

export type PlaceSuggestion = ForwardGeocodeResult & {
    id: string;
    title: string;
    subtitle: string;
    importance: number;
};

const searchCache = new Map<string, PlaceSuggestion[]>();
const reverseCache = new Map<string, ReverseGeocodeResult>();

export async function searchPlaces(
    query: string,
    signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
    const normalized = query.trim().toLowerCase();

    if (normalized.length < 3) {
        return [];
    }

    if (searchCache.has(normalized)) {
        return searchCache.get(normalized) ?? [];
    }

    const params = new URLSearchParams({
        format: 'jsonv2',
        q: query,
        limit: '5',
        addressdetails: '1',
        countrycodes: 'id',
    });

    const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
            headers: { Accept: 'application/json' },
            signal,
        },
    );

    if (!response.ok) {
        throw new Error('Forward geocoding failed');
    }

    const payload = (await response.json()) as NominatimResponse[];
    const suggestions = payload
        .filter((item) => item.lat && item.lon)
        .map((item, index) => mapSuggestion(item, normalized, index))
        .sort(
            (left, right) =>
                rankSuggestion(left, normalized) -
                rankSuggestion(right, normalized),
        )
        .slice(0, 5);

    searchCache.set(normalized, suggestions);

    return suggestions;
}

export async function searchAddress(
    query: string,
    signal?: AbortSignal,
): Promise<ForwardGeocodeResult | null> {
    const first = (await searchPlaces(query, signal))[0];

    if (!first) {
        return null;
    }

    return first;
}

export async function reverseGeocode(
    latitude: number,
    longitude: number,
    signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

    if (reverseCache.has(cacheKey)) {
        return reverseCache.get(cacheKey)!;
    }

    const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(latitude),
        lon: String(longitude),
        zoom: '18',
        addressdetails: '1',
    });

    const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
        {
            headers: { Accept: 'application/json' },
            signal,
        },
    );

    if (!response.ok) {
        throw new Error('Reverse geocoding failed');
    }

    const payload = (await response.json()) as NominatimResponse;

    const result = mapAddress(payload);
    reverseCache.set(cacheKey, result);

    return result;
}

function mapAddress(payload: NominatimResponse): ReverseGeocodeResult {
    const address = payload.address ?? {};

    return {
        formatted_address: payload.display_name ?? '',
        kelurahan: firstValue(address, [
            'suburb',
            'village',
            'hamlet',
            'neighbourhood',
            'quarter',
            'city_district',
        ]),
        kecamatan: firstValue(address, [
            'district',
            'county',
            'municipality',
            'city_district',
        ]),
        city: firstValue(address, [
            'city',
            'town',
            'regency',
            'county',
            'municipality',
        ]),
        province: firstValue(address, ['state', 'province', 'region']),
        postal_code: firstValue(address, ['postcode']),
    };
}

function firstValue(
    source: Record<string, string | undefined>,
    keys: string[],
): string {
    return keys.map((key) => source[key]).find(Boolean) ?? '';
}

function mapSuggestion(
    payload: NominatimResponse,
    normalizedQuery: string,
    index: number,
): PlaceSuggestion {
    const address = mapAddress(payload);
    const title = extractTitle(
        payload.display_name ?? '',
        address.formatted_address,
    );
    const subtitle = [address.kelurahan, address.kecamatan, address.city]
        .filter(Boolean)
        .join(', ');

    return {
        ...address,
        latitude: Number(payload.lat),
        longitude: Number(payload.lon),
        id: `${normalizedQuery}-${index}-${payload.lat}-${payload.lon}`,
        title,
        subtitle,
        importance: payload.importance ?? 0,
    };
}

function extractTitle(displayName: string, fallback: string): string {
    const firstSegment = displayName.split(',')[0]?.trim();

    return firstSegment || fallback || 'Lokasi';
}

function rankSuggestion(
    suggestion: PlaceSuggestion,
    normalizedQuery: string,
): number {
    const title = suggestion.title.toLowerCase();
    const subtitle = suggestion.subtitle.toLowerCase();
    const exactPrefix = title.startsWith(normalizedQuery) ? 0 : 1;
    const titleContains = title.includes(normalizedQuery) ? 0 : 1;
    const subtitleContains = subtitle.includes(normalizedQuery) ? 0 : 1;
    const importanceScore = 1 - Math.min(suggestion.importance || 0, 1);

    return (
        exactPrefix * 100 +
        titleContains * 10 +
        subtitleContains * 5 +
        importanceScore
    );
}
