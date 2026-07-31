export function buildCourierOutletAssignmentUrl(courier: {
    id: number;
    courier_profile?: { id: number } | null;
}): string {
    const profileId = courier.courier_profile?.id ?? courier.id;

    return `/owner/couriers/${profileId}/outlets`;
}
