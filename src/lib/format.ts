type Currency = "SGD" | string;

export function formatCurrency(amount: number, currency: Currency = "SGD") {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatSlotLabel(slot: {
  date: string;
  startTime: string;
  endTime: string;
}) {
  return `${formatLongDate(slot.date)} · ${slot.startTime} to ${slot.endTime}`;
}
