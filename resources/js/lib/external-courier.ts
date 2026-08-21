export interface ExternalCourierInput {
    provider: 'gojek' | 'grab';
    reference: string;
    name: string;
    phone: string;
    plate: string;
    cost: string;
}

export function buildExternalCourierPayload(input: ExternalCourierInput) {
    return {
        courier_type: 'eksternal' as const,
        external_provider: input.provider,
        external_reference: input.reference.trim() || null,
        external_courier_name: input.name.trim(),
        external_courier_phone: input.phone.trim() || null,
        external_plate_number: input.plate.trim() || null,
        courier_cost: input.cost,
    };
}
