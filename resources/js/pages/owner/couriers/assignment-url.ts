export function buildCourierOutletAssignmentUrl(courier: {
    id: number;
    courier_profile?: { id: number } | null;
}): string {
    const profileId = courier.courier_profile?.id;

    if (!profileId) {
        throw new Error('Courier profile id required for outlet assignment.');
    }

    return `/owner/couriers/${profileId}/outlets`;
}
