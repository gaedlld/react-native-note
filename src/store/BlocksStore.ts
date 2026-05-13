import type { Block } from "../types/block"

type Listener = () => void

/**
 * In-memory blocks store with two independent subscription channels:
 *
 *  - `subscribeBlock(id, fn)` — fires only when that specific block changes
 *    (replaced, patched, or deleted). Used by `useBlock(id)` so a single
 *    block update doesn't re-render the whole tree.
 *
 *  - `subscribeOrder(fn)` — fires when the visible flat order
 *    (`blocksOrder`) changes. Used by `RenderTree` and by anyone that needs
 *    to react to inserts/removes/moves.
 *
 * The store is intentionally transport-agnostic: it knows nothing about
 * remote/local ops. The op layer (PR 2) will be the only caller of the
 * mutating methods, so we get one funnel for both local and remote changes.
 *
 * NOTE: blocks are stored by reference. Every mutation MUST replace the
 * block with a new object reference (use the spread operator) so that
 * `getBlock(id)` returns a fresh value and `useSyncExternalStore` triggers
 * a re-render.
 */
export class BlocksStore {
  private blocks: Record<string, Block>
  private order: string[]
  private blockListeners = new Map<string, Set<Listener>>()
  private orderListeners = new Set<Listener>()

  constructor(initialBlocks: Record<string, Block>, initialOrder: string[]) {
    this.blocks = initialBlocks
    this.order = initialOrder
  }

  // ---------- reads ----------

  /** Live snapshot of the blocks map. The reference is stable across mutations. */
  getBlocks = (): Record<string, Block> => this.blocks

  /** Returns the current value for a block. Reference changes on every mutation of that block. */
  getBlock = (id: string): Block | undefined => this.blocks[id]

  /** Returns the current order array. Reference changes on every order mutation. */
  getOrder = (): string[] => this.order

  hasBlock = (id: string): boolean => id in this.blocks

  // ---------- subscriptions ----------

  subscribeBlock = (id: string, listener: Listener): (() => void) => {
    let set = this.blockListeners.get(id)
    if (!set) {
      set = new Set()
      this.blockListeners.set(id, set)
    }
    set.add(listener)
    return () => {
      const current = this.blockListeners.get(id)
      if (!current) return
      current.delete(listener)
      if (current.size === 0) this.blockListeners.delete(id)
    }
  }

  subscribeOrder = (listener: Listener): (() => void) => {
    this.orderListeners.add(listener)
    return () => {
      this.orderListeners.delete(listener)
    }
  }

  // ---------- mutations ----------

  /** Replace a block (or insert it if new). Notifies that block's subscribers. */
  setBlock(id: string, next: Block): void {
    this.blocks[id] = next
    this.notifyBlock(id)
  }

  /**
   * Shallow-merge top-level fields; **deep-merge** `properties` and `format` so
   * partial updates (e.g. `checked`, `url`) do not erase `title`.
   */
  patchBlock(id: string, patch: Partial<Block>): Block | undefined {
    const current = this.blocks[id]
    if (!current) return undefined
    const next: Block = {
      ...current,
      ...patch,
      properties:
        patch.properties !== undefined
          ? { ...current.properties, ...patch.properties }
          : current.properties,
      format:
        patch.format !== undefined ? { ...(current.format ?? {}), ...patch.format } : current.format
    }
    this.blocks[id] = next
    this.notifyBlock(id)
    return next
  }

  deleteBlock(id: string): void {
    if (!(id in this.blocks)) return
    delete this.blocks[id]
    this.notifyBlock(id)
  }

  /** Replace the order array with a new reference. Notifies order subscribers. */
  setOrder(next: string[]): void {
    this.order = next
    this.notifyOrder()
  }

  // ---------- notifiers (exposed for batched ops) ----------

  notifyBlock(id: string): void {
    const set = this.blockListeners.get(id)
    if (!set) return
    set.forEach((fn) => fn())
  }

  notifyOrder(): void {
    this.orderListeners.forEach((fn) => fn())
  }
}
