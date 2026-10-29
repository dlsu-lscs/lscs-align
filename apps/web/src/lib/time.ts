export function toMinutes(time: string): number {
  const [hour, min] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (min ?? 0);
}

export function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
