import { useForm } from "@inertiajs/react"
import { Button } from "@/components/ui/button"
import CustomSelect from "@/components/ui/custom-select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

interface Props {
  order: any
  couriers: any[]
  open: boolean
  onClose: () => void
}

export default function AssignCourierSheet({ order, couriers, open, onClose }: Props) {
  const form = useForm({ courier_id: couriers[0]?.id ?? "" })

  if (!order) {
return null
}

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    form.post(`/owner/orders/${order.id}/assign-courier`, {
      onSuccess: () => onClose(),
    })
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Assign Kurir</SheetTitle>
          <SheetDescription>
            Pilih kurir untuk pesanan {order?.order_code}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <CustomSelect
            value={String(form.data.courier_id)}
            onChange={(value) => form.setData("courier_id", value)}
            options={couriers.map((c) => ({ value: String(c.id), label: c.name }))}
          />
          <Button type="submit" loading={form.processing} className="w-full">
            Tugaskan Kurir
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
