let oversizedSkippedCount = 0;

export function recordOversizedSkipped(count: number): void {
  oversizedSkippedCount = count;
}

export function getOversizedSkippedCount(): number {
  return oversizedSkippedCount;
}
