import { useMemo } from "react"

import { remoteCollaboratorIdsForBlock } from "../collaboration/client-single-writer"
import { useBlocksContext } from "../components/BlocksContext"

/**
 * Presence ids of **other** collaborators currently focused on this block (from
 * `collaboration.presence`). Empty when collaboration is disabled or nobody else
 * claims focus here. Map ids to avatars / names in your app.
 */
export function useRemoteBlockFocusPeers(blockId: string): string[] {
  const { collaboration } = useBlocksContext()
  return useMemo(
    () => remoteCollaboratorIdsForBlock(collaboration, blockId),
    [collaboration, blockId]
  )
}
