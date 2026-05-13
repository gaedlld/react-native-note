import React, { createContext, useContext } from "react"
import { Pressable, type StyleProp, View, type ViewStyle } from "react-native"

import type { ClientSingleWriterCollaboration } from "../collaboration/client-single-writer"
import { useKeyboardStatus } from "../hooks/use-keyboard-status"
import { useRemoteBlockFocusPeers } from "../hooks/use-remote-block-focus-peers"
import type { BlocksTransport } from "../transport/BlocksTransport"
import type { Block } from "../types/block"
import { BlockRegistration, useBlockRegistrationContext } from "./BlockRegistration"
import {
  type BlocksContextValue,
  BlocksProvider,
  useBlock,
  useBlocksContext
} from "./BlocksContext"
import { BlocksMeasuresProvider } from "./BlocksMeasuresProvider"
import { LayoutProvider } from "./LayoutProvider"
import { ScrollProvider } from "./ScrollProvider"
import { TextBlocksProvider, useTextBlocksContext } from "./TextBlocksProvider"

export interface RemoteFocusIndicatorProps {
  blockId: string
  /** Collaborator ids from `collaboration.presence` focused on this block (never includes you). */
  remotePeerIds: string[]
}

export interface BlankSpacePressArgs {
  blocks: BlocksContextValue["blocks"]
  blocksOrder: BlocksContextValue["blocksOrder"]
  inputRefs: ReturnType<typeof useTextBlocksContext>["inputRefs"]
  insertBlock: BlocksContextValue["insertBlock"]
}

export type OnBlankSpacePress = (args: BlankSpacePressArgs) => void

export interface EditorChromeContextValue {
  /** When false, page blocks hide icon/cover UI (existing format fields are untouched). Default true. */
  showPageIconAndCover: boolean
}

const EditorChromeContext = createContext<EditorChromeContextValue | null>(null)

export function useEditorChrome(): EditorChromeContextValue {
  const ctx = useContext(EditorChromeContext)
  if (ctx === null) {
    throw new Error("useEditorChrome must be used within Editor")
  }
  return ctx
}

interface BlankSpaceProps {
  onBlankSpacePress?: OnBlankSpacePress
}

const BlankSpace = ({ onBlankSpacePress }: BlankSpaceProps) => {
  const { keyboardHeight } = useKeyboardStatus()
  const { blocks, blocksOrder, insertBlock } = useBlocksContext()
  const { inputRefs } = useTextBlocksContext()

  const handleBlankSpacePress = () =>
    onBlankSpacePress?.({
      blocks,
      blocksOrder,
      insertBlock,
      inputRefs
    })

  return (
    <Pressable
      onPress={handleBlankSpacePress}
      style={{
        flexGrow: 1,
        minHeight: keyboardHeight + 64,
        backgroundColor: "transparent"
      }}
    />
  )
}

interface RenderTreeProps {
  onBlankSpacePress?: OnBlankSpacePress
  renderRemoteFocusIndicator?: (props: RemoteFocusIndicatorProps) => React.ReactNode
}

/**
 * Renders a single block. Subscribes to that block via `useBlock(id)` so that
 * a `turnBlockInto` (which only changes `block.type`) re-renders this slot
 * alone without re-rendering the rest of the tree.
 */
function BlockSlot({
  blockId,
  renderRemoteFocusIndicator
}: {
  blockId: string
  renderRemoteFocusIndicator?: (props: RemoteFocusIndicatorProps) => React.ReactNode
}) {
  const { blockTypes } = useBlockRegistrationContext()
  const block = useBlock(blockId)
  const Component = blockTypes[block.type]?.component
  const remotePeerIds = useRemoteBlockFocusPeers(blockId)
  if (!Component) return null
  return (
    <LayoutProvider blockId={blockId}>
      <View style={{ position: "relative", backgroundColor: "transparent" }}>
        {renderRemoteFocusIndicator?.({ blockId, remotePeerIds })}
        <Component blockId={blockId} />
      </View>
    </LayoutProvider>
  )
}

function RenderTree(props: RenderTreeProps) {
  const { onBlankSpacePress, renderRemoteFocusIndicator } = props
  const { blocksOrder } = useBlocksContext()

  return (
    <>
      {/* We concat the "root" content (should be just one item) with the content of its only child. */}
      {blocksOrder.map((blockId: string) => (
        <BlockSlot
          key={`block-${blockId}`}
          blockId={blockId}
          renderRemoteFocusIndicator={renderRemoteFocusIndicator}
        />
      ))}

      <BlankSpace onBlankSpacePress={onBlankSpacePress} />
    </>
  )
}

interface EditorProps {
  children: React.ReactNode
  defaultBlockType: string
  extractBlocks?: (blocks: Record<string, Block>) => void
  defaultBlocks?: Record<string, Block>
  contentContainerStyle?: StyleProp<ViewStyle>
  /** Component to render above the keyboard */
  ToolbarComponent?: React.ComponentType
  /** Fires when a blank space is pressed */
  onBlankSpacePress?: OnBlankSpacePress
  /** Sync / persistence — receives every locally dispatched editor op */
  transport?: BlocksTransport | null
  /** Client-only `text` op gating from collaborator presence */
  collaboration?: ClientSingleWriterCollaboration | null
  /**
   * Render avatars / badges on blocks where {@link collaboration} reports another
   * peer focused. Use `absolute` positioning inside the returned subtree.
   */
  renderRemoteFocusIndicator?: (props: RemoteFocusIndicatorProps) => React.ReactNode
  /** Hide page icon / cover controls and imagery (default true). */
  showPageIconAndCover?: boolean
}

export function Editor(props: EditorProps) {
  const {
    children,

    defaultBlockType,

    extractBlocks,
    defaultBlocks,
    contentContainerStyle,
    ToolbarComponent,

    onBlankSpacePress,

    transport,

    collaboration,

    renderRemoteFocusIndicator,

    showPageIconAndCover = true
  } = props

  if (defaultBlockType === undefined) throw new Error("defaultBlockType is required")
  if (children === undefined) throw new Error("children is required")

  const editorChrome = React.useMemo(
    (): EditorChromeContextValue => ({ showPageIconAndCover }),
    [showPageIconAndCover]
  )

  return (
    <EditorChromeContext.Provider value={editorChrome}>
      <BlockRegistration customBlocks={children} defaultBlockType={defaultBlockType}>
        <BlocksProvider
          defaultBlocks={defaultBlocks ?? {}}
          extractBlocks={extractBlocks}
          transport={transport}
          collaboration={collaboration}
        >
          <TextBlocksProvider>
            <BlocksMeasuresProvider>
              <ScrollProvider contentContainerStyle={contentContainerStyle}>
                <RenderTree
                  onBlankSpacePress={onBlankSpacePress}
                  renderRemoteFocusIndicator={renderRemoteFocusIndicator}
                />
              </ScrollProvider>
            </BlocksMeasuresProvider>

            {ToolbarComponent ? <ToolbarComponent /> : null}
          </TextBlocksProvider>
        </BlocksProvider>
      </BlockRegistration>
    </EditorChromeContext.Provider>
  )
}
