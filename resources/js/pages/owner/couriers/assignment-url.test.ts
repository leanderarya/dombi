import { describe, expect, it } from 'vitest';
import { buildCourierOutletAssignmentUrl } from './assignment-url';

describe('buildCourierOutletAssignmentUrl', () => {
    it('uses courier profile id instead of user id', () => {
        expect(
            buildCourierOutletAssignmentUrl({
                id: 77,
                courier_profile: { id: 12 },
            }),
        ).toBe('/owner/couriers/12/outlets');
    });

    it('throws when courier profile is missing', () => {
        expect(() => buildCourierOutletAssignmentUrl({ id: 77 })).toThrow(
            'Courier profile id required for outlet assignment.',
        );
    });
});
