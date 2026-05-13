import type { TextDelta } from "../text/deltas"
import type { Block } from "../types/block"

/** Where an op came from — controls whether `BlocksTransport.send` runs. */
export type OpOrigin = "local" | "remote"

/** Insert position relative to siblings inside the parent block's `content`. */
export interface InsertBlockPosition {
  prevBlockId?: string
  nextBlockId?: string
}

/**
 * Serializable editor mutation. All local UI actions flow through `dispatch(op)`
 * so transports (InstantDB, Supabase, legend-state, …) can observe the same ops.
 *
 * Optional **`meta`**: adapter-only payload (client clock, tracing, doc revision).
 * Core **`applyOp` ignores `meta`** — strip before persistence if your log must stay canonical.
 *
 * Block-specific fields (todo checked, link URL, …) belong in **`patchBlock.patch.properties`**
 * (or `format`); see `blockPropertyKinds.ts` for suggested shapes.
 */
type OpVariants =
  | { type: "insert"; block: Block; position?: InsertBlockPosition }
  | { type: "remove"; blockId: string }
  | {
      type: "move"
      blockId: string
      parentId: string
      targetId: string
      closestTo: "start" | "end"
    }
  | { type: "merge"; sourceBlockId: string; targetBlockId: string }
  | {
      type: "split"
      blockId: string
      selection: { start: number; end: number }
    }
  | { type: "turnInto"; blockId: string; blockType: string }
  | { type: "setBlock"; block: Block }
  | { type: "patchBlock"; blockId: string; patch: Partial<Block> }
  /** Granular change to `properties.title` (presence should enforce single writer per block). */
  | { type: "text"; blockId: string; deltas: TextDelta[] }

export type Op = OpVariants & {
  meta?: Record<string, unknown>
}

export interface ApplyOpContext {
  /** Used when splitting the first visible block (same as previous `BlocksProvider`). */
  defaultBlockType: string
}

/** Return value from `applyOp` — only split / merge / turnInto produce payloads. */
export type ApplyOpResult =
  | { kind: "none" }
  | { kind: "split"; prevBlock: Block; nextBlock: Block }
  | {
      kind: "merge"
      prevTitle: string
      newTitle: string
      mergeResult: Block
    }
  | { kind: "turnInto"; block: Block }
