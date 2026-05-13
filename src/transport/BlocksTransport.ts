import type { ApplyOpResult, Op, OpOrigin } from "../ops/types"

/**
 * Optional second argument to {@link BlocksTransport.send}.
 * Use when something must reach the adapter but **must not** be replayed through `applyOp`
 * (unlike {@link Op} `meta`, which is still part of the serializable op envelope).
 */
export interface BlocksTransportSendExtras {
  envelope?: Record<string, unknown>
}

/**
 * Handed to {@link BlocksTransport.connect} once the editor store exists.
 * Use `dispatch(op, "remote")` for inbound ops so `send` is not called again.
 */
export interface BlocksCollaborationApi {
  dispatch: (op: Op, origin?: OpOrigin) => ApplyOpResult
}

/**
 * Pluggable sync / persistence layer. Implement this with InstantDB, Supabase,
 * legend-state, websockets, SQLite replication, etc.
 *
 * Only **local** ops invoke `send` (see `dispatch` in `BlocksProvider`).
 * Remote replay: prefer `connect(({ dispatch }))` and call `dispatch(op, "remote")`,
 * or `useBlocksContext().dispatch(op, "remote")` inside React, or `applyOp`
 * if you are outside React.
 *
 * **Block-specific state** (todo checked, link URL, …) travels inside ops — typically
 * `{ type: "patchBlock", blockId, patch: { properties: { checked: true } } } }`.
 * `properties` / `format` patches are deep-merged so partial updates keep `title`.
 * Optional {@link Op} `meta` is ignored by `applyOp`. Use {@link BlocksTransportSendExtras}
 * for adapter-only side channels.
 */
export interface BlocksTransport {
  /**
   * Persist or broadcast a locally produced op. Errors should be handled inside
   * the adapter (the editor does not await this by default).
   */
  send(op: Op, extras?: BlocksTransportSendExtras): void | Promise<void>

  /**
   * Called once when `BlocksProvider` mounts (and again if `transport` changes).
   * Subscribe to your collaboration channel here and forward inbound ops with
   * `api.dispatch(op, "remote")`. Return a cleanup to unsubscribe.
   *
   * Memoize your transport object in the host app so this is not re-run every render.
   */
  connect?(api: BlocksCollaborationApi): void | (() => void)
}
