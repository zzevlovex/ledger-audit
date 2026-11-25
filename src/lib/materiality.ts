import type { Benchmark, Cents, Materiality } from './types'

export const BENCHMARKS: Record<Benchmark, { label: string; range: string }> = {
  revenue: { label: 'Revenue', range: '0.5%–1%' },
  assets: { label: 'Total assets', range: '1%–2%' },
  pretax: { label: 'Pre-tax income', range: '5%–10%' },
}

// Common practice: performance materiality 75% of overall, clearly trivial 5% of overall.
export const PERFORMANCE_RATIO = 0.75
export const TRIVIAL_RATIO = 0.05

export function computeMateriality(benchmark: Benchmark, base: Cents, pct: number): Materiality {
  const overall = Math.round((Math.abs(base) * pct) / 100)
  return {
    benchmark,
    base,
    pct,
    overall,
    performance: Math.round(overall * PERFORMANCE_RATIO),
    trivial: Math.round(overall * TRIVIAL_RATIO),
  }
}
