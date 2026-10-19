export function formatGhs(pesewas: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((pesewas || 0) / 100);
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  payment_pending: "Payment pending",
  placed: "Order placed",
  accepted: "Accepted",
  preparing: "Being prepared",
  on_the_way: "On the way",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const SERVICE_STATUS_LABEL: Record<string, string> = {
  submitted: "Request submitted",
  quoted: "Quote ready",
  accepted: "Accepted",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  pending_confirmation: "Awaiting provider",
  confirmed: "Confirmed",
};

export const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  "printing-binding": "Printing & Binding",
  laundry: "Laundry Booking",
  "parcel-pickup": "Parcel Pickup & Delivery",
  "room-cleaning": "Room Cleaning Booking",
  "repairs-tech": "Repairs & Tech Help",
  "barber-beauty": "Barber & Beauty Booking",
};

export function serviceDisplayName(slug: string, fallback: string): string {
  return SERVICE_DISPLAY_NAMES[slug] ?? fallback;
}

export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  return error.message.replace(/^TRPCClientError:\s*/, "");
}
