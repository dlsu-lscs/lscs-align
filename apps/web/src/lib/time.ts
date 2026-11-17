export function toMinutes(time: string): number {
  const [hour, min] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (min ?? 0);
}

export function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function formatTime(minute: number): string {
  const hours = Math.floor(minute / 60);
  const min = minute % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(min).padStart(2, '0')} ${period}`;
}
