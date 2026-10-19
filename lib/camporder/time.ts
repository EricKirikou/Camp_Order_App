export function createFutureBookingTime(hoursFromNow: number): string {
  const offset = Math.max(1, Math.min(Math.floor(hoursFromNow), 24 * 30));
  return new Date(Date.now() + offset * 60 * 60 * 1000).toISOString();
}

export function isFutureBookingTime(value: string): boolean {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}
