/** Simulated latency so mock-provider loading states are actually visible
 * and testable in the UI, instead of resolving instantly. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
