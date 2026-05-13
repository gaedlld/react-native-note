export type UUIDv4 = string

export interface BlockProperties {
  /** Plain-text body / line content for text-like blocks. */
  title: string
  source?: string
  /**
   * Arbitrary per-type payload (`checked`, `url`, …). Prefer typed helpers in
   * `block-property-kinds.ts` for common shapes.
   */
  [key: string]: unknown
}

export interface BlockFormat {
  page_icon?: string
  page_cover?: string
  block_width?: number
  block_aspect_ratio?: number
  [key: string]: unknown
}

export interface Block {
  id: string
  type: string
  properties: BlockProperties
  format?: BlockFormat
  content: string[]
  parent: string
}

export type CreateBlockInput = Omit<Block, "id"> & { id?: string }
