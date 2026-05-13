import type { BlockProperties } from "./block"

/**
 * Suggested `properties` shapes for block types. Store these fields via
 * `updateBlockV2` / `patchBlock` ops — they replicate through your BlocksTransport.
 */

/** To-do / checkbox — `checked` is independent of `title` text deltas. */
export type CheckboxProperties = BlockProperties & {
  checked?: boolean
}

/** Future link block — URL metadata alongside editable title. */
export type LinkProperties = BlockProperties & {
  url?: string
  /** Optional display label when it differs from `title`. */
  hrefLabel?: string
}
