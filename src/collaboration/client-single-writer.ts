/**
 * Client-only single-writer heuristic from realtime presence: each collaborator
 * exposes `focusedBlockId`. No server lease — ties are broken deterministically.
 */

export type BlockPresence = {
  focusedBlockId: string | null
}

/** Collaborator id → where they are focused in the document */
export type CollaboratorsPresence = Record<string, BlockPresence>

export interface ClientSingleWriterCollaboration {
  /** This session’s id — merged into the writer presence map with live local focus. */
  clientId: string
  /** Remote collaborators only is fine; local rows are overridden by the editor. */
  presence: CollaboratorsPresence
}

/**
 * Presence map used for writer policy: remote rows from `collaboration.presence`,
 * with this session’s `focusedBlockId` taken from the live editor (not a possibly
 * stale copy mirrored from the host).
 */
export function mergeLocalWriterPresence(
  collab: ClientSingleWriterCollaboration,
  liveLocalFocusedBlockId: string | null
): CollaboratorsPresence {
  return {
    ...collab.presence,
    [collab.clientId]: { focusedBlockId: liveLocalFocusedBlockId }
  }
}

/**
 * Collaborator ids (presence map keys) **other than** {@link ClientSingleWriterCollaboration.clientId}
 * whose `focusedBlockId` equals `blockId`. Use for avatars / focus rings (UI only).
 */
export function remoteCollaboratorIdsForBlock(
  collab: ClientSingleWriterCollaboration | null,
  blockId: string
): string[] {
  if (!collab) return []
  return Object.entries(collab.presence)
    .filter(([peerId, p]) => peerId !== collab.clientId && p.focusedBlockId === blockId)
    .map(([peerId]) => peerId)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/** Collaborators currently claiming focus on `blockId`, sorted for stable tie-break. */
export function writersForBlock(presence: CollaboratorsPresence, blockId: string): string[] {
  return Object.entries(presence)
    .filter(([, p]) => p.focusedBlockId === blockId)
    .map(([id]) => id)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * One canonical writer per block when presence disagrees: lexicographically
 * smallest collaborator id wins. Returns `null` if nobody reports focus on the block.
 */
export function canonicalWriterForBlock(
  presence: CollaboratorsPresence,
  blockId: string
): string | null {
  const w = writersForBlock(presence, blockId)
  return w.length === 0 ? null : w[0]
}

/** Whether this session may emit local `text` ops for `blockId`. */
export function canEmitLocalTextOp(input: {
  clientId: string
  presence: CollaboratorsPresence
  blockId: string
  localFocusedBlockId: string | null
}): boolean {
  if (input.localFocusedBlockId !== input.blockId) return false
  const canon = canonicalWriterForBlock(input.presence, input.blockId)
  if (canon !== null) return canon === input.clientId
  return true
}

/** Whether an inbound remote `text` op for `blockId` should be applied locally. */
export function shouldApplyRemoteTextOp(input: {
  clientId: string
  presence: CollaboratorsPresence
  blockId: string
}): boolean {
  const canon = canonicalWriterForBlock(input.presence, input.blockId)
  if (canon === null) return true
  return canon !== input.clientId
}

/**
 * Whether this session should keep the block title field focusable/editable in the UI.
 * Does **not** require local focus on that block — unlike {@link canEmitLocalTextOp}, which
 * avoids “editable false → can never focus → never becomes writer”.
 */
export function canInteractWithBlockText(input: {
  clientId: string
  presence: CollaboratorsPresence
  blockId: string
  liveLocalFocusedBlockId: string | null
}): boolean {
  const presenceForPolicy = mergeLocalWriterPresence(
    { clientId: input.clientId, presence: input.presence },
    input.liveLocalFocusedBlockId
  )
  const canon = canonicalWriterForBlock(presenceForPolicy, input.blockId)
  if (canon !== null && canon !== input.clientId) return false
  return true
}
