/**
 * Character-level edit expressed as a minimal OT-friendly sequence.
 * Typical shape from `singleEditDelta`: `[retain, delete?, insert?]`.
 */
export type TextDelta = { retain: number } | { insert: string } | { delete: number }

/**
 * Computes a single contiguous edit between two strings (matches one
 * `TextInput` `onChangeText` event).
 */
export function singleEditDelta(prev: string, next: string): TextDelta[] {
  if (prev === next) return []

  let head = 0
  const minLen = Math.min(prev.length, next.length)
  while (head < minLen && prev[head] === next[head]) {
    head++
  }

  let tailPrev = prev.length
  let tailNext = next.length
  while (tailPrev > head && tailNext > head && prev[tailPrev - 1] === next[tailNext - 1]) {
    tailPrev--
    tailNext--
  }

  const deltas: TextDelta[] = []
  if (head > 0) {
    deltas.push({ retain: head })
  }
  const removed = tailPrev - head
  const inserted = next.slice(head, tailNext)
  if (removed > 0) {
    deltas.push({ delete: removed })
  }
  if (inserted.length > 0) {
    deltas.push({ insert: inserted })
  }
  return deltas
}

/** Applies a delta sequence produced by `singleEditDelta` to `prev`. */
export function applyDeltas(prev: string, deltas: TextDelta[]): string {
  let i = 0
  let out = ""
  for (const d of deltas) {
    if ("retain" in d) {
      out += prev.slice(i, i + d.retain)
      i += d.retain
    } else if ("delete" in d) {
      i += d.delete
    } else {
      out += d.insert
    }
  }
  out += prev.slice(i)
  return out
}
