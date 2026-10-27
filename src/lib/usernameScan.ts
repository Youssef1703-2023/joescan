/**
 * Username (HudsonRock) scan result helpers — pure functions.
 *
 * UsernameAnalyzer renders its verdict from React state (`breachData`),
 * which only updates on the next render. Anything that must be decided
 * inside the same scan handler — notably the risk saved to scan history —
 * must therefore be derived from the LOCAL fetch result, never from the
 * just-set state variable, or the saved risk lags one scan behind.
 * These helpers keep the display formula and the saved-history formula
 * identical: a scan counts as compromised when HudsonRock reports any
 * stealers, falling back to total_results when the stealers list is empty.
 */

export interface UsernameBreachData {
  stealers?: unknown[] | null;
  total_results?: number | null;
}

export function countUsernameStealers(
  data: UsernameBreachData | null | undefined,
): number {
  return data?.stealers?.length || data?.total_results || 0;
}

export function usernameBreachRisk(
  data: UsernameBreachData | null | undefined,
): 'High' | 'Low' {
  return countUsernameStealers(data) > 0 ? 'High' : 'Low';
}
