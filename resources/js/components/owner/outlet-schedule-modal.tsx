import OperatingHoursManager from '@/components/owner/operating-hours-manager';
import HolidayManager from '@/components/owner/holiday-manager';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
    outletId: number;
    initialHours: any[];
    initialHolidays: any[];
    open: boolean;
    onClose: () => void;
}

export default function OutletScheduleModal({ outletId, initialHours, initialHolidays, open, onClose }: Props) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="z-[2000] max-w-lg max-h-[90vh] overflow-y-auto" overlayClassName="z-[1999]">
                <DialogHeader>
                    <DialogTitle>Edit Jadwal Outlet</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold text-text mb-2">Jam Operasional</h3>
                        <OperatingHoursManager outletId={outletId} initialHours={initialHours} />
                    </div>
                    <div className="border-t border-border pt-4">
                        <h3 className="text-sm font-semibold text-text mb-2">Hari Libur</h3>
                        <HolidayManager outletId={outletId} initialHolidays={initialHolidays} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Tutup</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
