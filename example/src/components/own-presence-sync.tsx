import { useEffect } from "react"
import { useBlocksContext } from "react-native-note"

/**
 * Mirrors focused block id into React state (e.g. to publish into your realtime
 * presence channel). Writer rules in core use live editor focus, not this value.
 */
export function OwnPresenceSync({
  clientId,
  onOwnFocusedBlockChange
}: {
  clientId: string
  onOwnFocusedBlockChange: (clientId: string, focusedBlockId: string | null) => void
}) {
  const { focusedBlockId } = useBlocksContext()

  useEffect(() => {
    onOwnFocusedBlockChange(clientId, focusedBlockId)
  }, [clientId, focusedBlockId, onOwnFocusedBlockChange])

  return null
}
