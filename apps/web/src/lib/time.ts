export function toMinutes(time: string): number {
    const [hour, min] = time.split(':').map(Number);
    return (hour ?? 0) * 60 + (min ?? 0);
}