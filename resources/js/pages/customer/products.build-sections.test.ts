import { describe, expect, it } from 'vitest';
import { buildSections } from './products';

const variant = (
    id: number,
    name: string,
    over: Record<string, unknown> = {},
) => ({
    id,
    name,
    flavor: null,
    size: null,
    price: 1000,
    is_active: true,
    ...over,
});

describe('buildSections', () => {
    it('kehitung sebagai baris terpisah utk produk standalone tanpa flavor', () => {
        const families = [
            {
                id: 3,
                name: 'Makanan',
                description: null,
                variants: [
                    variant(11, 'Bolu Ketan', { price: 2500 }),
                    variant(12, 'Kimpul', { price: 1500 }),
                ],
            },
        ];

        const sections = buildSections(families, 'all');

        expect(sections).toHaveLength(1);
        expect(sections[0].flavorGroups).toHaveLength(2);
        expect(sections[0].flavorGroups.map((g) => g.displayLabel)).toEqual([
            'Bolu Ketan',
            'Kimpul',
        ]);
    });

    it('menggabungkan varian ber-flavor sama dalam satu baris', () => {
        const families = [
            {
                id: 1,
                name: 'Biogoat',
                description: null,
                variants: [
                    variant(4, 'Original', { flavor: 'Original', price: 2000 }),
                    variant(5, 'Chocolate', {
                        flavor: 'Chocolate',
                        price: 3000,
                    }),
                ],
            },
        ];

        const sections = buildSections(families, 'all');

        expect(sections[0].flavorGroups).toHaveLength(2);
        expect(sections[0].flavorGroups.map((g) => g.displayLabel)).toEqual([
            'Biogoat Original',
            'Biogoat Chocolate',
        ]);
    });

    it('hanya menampilkan family yg dipilih saat filter aktif', () => {
        const families = [
            {
                id: 1,
                name: 'A',
                description: null,
                variants: [variant(1, 'a')],
            },
            {
                id: 2,
                name: 'B',
                description: null,
                variants: [variant(2, 'b')],
            },
        ];

        const sections = buildSections(families, '2');

        expect(sections).toHaveLength(1);
        expect(sections[0].familyId).toBe(2);
    });
});
