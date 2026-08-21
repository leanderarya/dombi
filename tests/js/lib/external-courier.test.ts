import { describe, expect, it } from 'vitest';
import { buildExternalCourierPayload } from '@/lib/external-courier';

describe('buildExternalCourierPayload', () => {
    it('keeps provider, reference, identity, and actual cost separate', () => {
        expect(buildExternalCourierPayload({
            provider: 'grab',
            reference: ' GR-9988 ',
            name: ' Budi ',
            phone: '',
            plate: ' H 1234 AB ',
            cost: '18000',
        })).toEqual({
            courier_type: 'eksternal',
            external_provider: 'grab',
            external_reference: 'GR-9988',
            external_courier_name: 'Budi',
            external_courier_phone: null,
            external_plate_number: 'H 1234 AB',
            courier_cost: '18000',
        });
    });
});
