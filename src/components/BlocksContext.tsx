import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react"

import type { ClientSingleWriterCollaboration } from "../collaboration/client-single-writer"
import {
  canEmitLocalTextOp,
  canInteractWithBlockText,
  mergeLocalWriterPresence,
  shouldApplyRemoteTextOp
} from "../collaboration/client-single-writer"
import { applyOp } from "../ops/apply-op"
import type { ApplyOpResult, InsertBlockPosition, Op, OpOrigin } from "../ops/types"
import { BlocksStore } from "../store/BlocksStore"
import type { BlocksTransport } from "../transport/BlocksTransport"
import type { Block } from "../types/block"
import { type BlockTypesMap, useBlockRegistrationContext } from "./BlockRegistration"

export type { ApplyOpContext, ApplyOpResult, InsertBlockPosition, Op, OpOrigin } from "../ops/types"

export interface BlocksContextValue {
  /**
   * Single funnel for all structural / metadata mutations. Local dispatches
   * optionally forward to `transport.send`; use `origin: "remote"` when
   * replaying ops from the network so nothing is echoed back.
   */
  dispatch: (op: Op, origin?: OpOrigin) => ApplyOpResult

  blocks: Record<string, Block>
  blocksOrder: string[]
  focusedBlockId: string | null
  setFocusedBlockId: (blockId: string | null) => void
  movingBlockId: string | null
  setMovingBlockId: (blockId: string | null) => void
  selectedBlockId: string | null
  setSelectedBlockId: (blockId: string | null) => void
  shouldUpdate: string[]
  setShouldUpdate: (ids: string[]) => void
  insertBlock: (newBlock: Block, position?: InsertBlockPosition) => void
  splitBlock: (
    block: Block,
    selection: { start: number; end: number }
  ) => {
    prevBlock: Block
    nextBlock: Block
  }
  moveBlock: (
    blockId: string,
    parentId: string,
    targetId: string,
    closestTo: "start" | "end"
  ) => void
  mergeBlock: (
    block: Block,
    targetBlockId: string
  ) => {
    prevTitle: string
    newTitle: string
    mergeResult: Block
  }
  removeBlock: (blockId: string) => void
  turnBlockInto: (blockId: string, blockType: string) => Block
  updateBlock: (updatedBlock: Block) => void
  updateBlockV2: (blockId: string, blockData: Partial<Block>) => void
  getBlockSnapshot: (blockId: string) => Block
  blockTypes: BlockTypesMap
  textBasedBlocks: string[]

  /**
   * When collaboration is enabled, false if another collaborator is the canonical
   * writer for this block’s title (read-only). Still true when nobody focuses that
   * block yet so the field can receive focus; {@link dispatch} remains gated by
   * focus + writer rules for `text` ops.
   */
  canEditBlockText: (blockId: string) => boolean

  /** Same config passed to `BlocksProvider` / `Editor`; `null` when collaboration is off. */
  collaboration: ClientSingleWriterCollaboration | null
}

const BlocksContext = createContext<BlocksContextValue | null>(null)
const BlocksStoreContext = createContext<BlocksStore | null>(null)

function useBlocksContext(): BlocksContextValue {
  const blocksContext = useContext(BlocksContext)
  if (blocksContext === null) {
    throw new Error("useBlocksContext must be used within a BlocksContextProvider")
  }
  return blocksContext
}

function useBlocksStore(): BlocksStore {
  const store = useContext(BlocksStoreContext)
  if (store === null) {
    throw new Error("useBlocksStore must be used within a BlocksProvider")
  }
  return store
}

function useBlock(blockId: string): Block {
  const store = useBlocksStore()
  const subscribe = useCallback(
    (listener: () => void) => store.subscribeBlock(blockId, listener),
    [store, blockId]
  )
  const getSnapshot = useCallback(() => store.getBlock(blockId), [store, blockId])
  const block = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  if (!block) {
    throw new Error(`Block "${blockId}" does not exist`)
  }
  return block
}

interface BlocksProviderProps {
  children: ReactNode
  defaultBlocks: Record<string, Block>
  extractBlocks?: (blocks: Record<string, Block>) => void
  /** Optional sync layer — receives every locally dispatched `Op`. */
  transport?: BlocksTransport | null
  /**
   * Client-only single-writer for `text` ops from presence (`focusedBlockId`).
   * Omit to disable gating.
   */
  collaboration?: ClientSingleWriterCollaboration | null
}

function BlocksProvider({
  children,
  defaultBlocks,
  extractBlocks,
  transport,
  collaboration
}: BlocksProviderProps) {
  const storeRef = useRef<BlocksStore | null>(null)
  if (storeRef.current === null) {
    const initialBlocks: Record<string, Block> = {
      root: {
        id: "root",
        type: "root",
        properties: { title: "" },
        content: Object.keys(defaultBlocks),
        parent: "root"
      },
      ...defaultBlocks
    }
    const rootContent = initialBlocks.root?.content ?? []
    const firstChild = rootContent[0]
    const initialOrder =
      rootContent.length > 0 && firstChild
        ? [firstChild, ...(initialBlocks[firstChild]?.content ?? [])]
        : []
    storeRef.current = new BlocksStore(initialBlocks, initialOrder)
  }
  const store = storeRef.current

  const { defaultBlockType, textBasedBlocks, blockTypes } = useBlockRegistrationContext()

  const blocksOrder = useSyncExternalStore(store.subscribeOrder, store.getOrder, store.getOrder)

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const [movingBlockId, setMovingBlockId] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [shouldUpdate, setShouldUpdate] = useState<string[]>([])

  const collaborationRef = useRef(collaboration ?? null)
  collaborationRef.current = collaboration ?? null
  const focusedBlockIdRef = useRef(focusedBlockId)
  focusedBlockIdRef.current = focusedBlockId

  const transportRef = useRef(transport)
  useEffect(() => {
    transportRef.current = transport
  }, [transport])

  const dispatch = useCallback(
    (op: Op, origin: OpOrigin = "local"): ApplyOpResult => {
      const collab = collaborationRef.current
      if (op.type === "text" && collab) {
        const presenceForPolicy = mergeLocalWriterPresence(collab, focusedBlockIdRef.current)
        if (origin === "local") {
          if (
            !canEmitLocalTextOp({
              clientId: collab.clientId,
              presence: presenceForPolicy,
              blockId: op.blockId,
              localFocusedBlockId: focusedBlockIdRef.current
            })
          ) {
            return { kind: "none" }
          }
        } else if (
          !shouldApplyRemoteTextOp({
            clientId: collab.clientId,
            presence: presenceForPolicy,
            blockId: op.blockId
          })
        ) {
          return { kind: "none" }
        }
      }

      const result = applyOp(store, op, { defaultBlockType })
      if (origin === "local") {
        const t = transportRef.current
        if (t?.send) {
          void Promise.resolve(t.send(op, undefined))
        }
      }
      return result
    },
    [store, defaultBlockType]
  )

  useEffect(() => {
    const t = transport
    if (!t?.connect) return
    return t.connect({ dispatch })
  }, [transport, dispatch])

  useEffect(() => {
    extractBlocks?.(store.getBlocks())
  }, [blocksOrder, store, extractBlocks])

  const insertBlock = useCallback(
    (newBlock: Block, position?: InsertBlockPosition) => {
      dispatch({ type: "insert", block: newBlock, position }, "local")
    },
    [dispatch]
  )

  const splitBlock = useCallback(
    (block: Block, selection: { start: number; end: number }) => {
      const r = dispatch({ type: "split", blockId: block.id, selection }, "local")
      if (r.kind !== "split") {
        throw new Error("splitBlock: unexpected applyOp result")
      }
      return { prevBlock: r.prevBlock, nextBlock: r.nextBlock }
    },
    [dispatch]
  )

  const mergeBlock = useCallback(
    (block: Block, targetBlockId: string) => {
      const r = dispatch({ type: "merge", sourceBlockId: block.id, targetBlockId }, "local")
      if (r.kind !== "merge") {
        throw new Error("mergeBlock: unexpected applyOp result")
      }
      return {
        prevTitle: r.prevTitle,
        newTitle: r.newTitle,
        mergeResult: r.mergeResult
      }
    },
    [dispatch]
  )

  const removeBlock = useCallback(
    (blockId: string) => {
      dispatch({ type: "remove", blockId }, "local")
    },
    [dispatch]
  )

  const moveBlock = useCallback(
    (blockId: string, parentId: string, targetId: string, closestTo: "start" | "end") => {
      dispatch({ type: "move", blockId, parentId, targetId, closestTo }, "local")
    },
    [dispatch]
  )

  const turnBlockInto = useCallback(
    (blockId: string, blockType: string): Block => {
      const r = dispatch({ type: "turnInto", blockId, blockType }, "local")
      if (r.kind !== "turnInto") {
        throw new Error("turnBlockInto: unexpected applyOp result")
      }
      return r.block
    },
    [dispatch]
  )

  const updateBlock = useCallback(
    (updatedBlock: Block) => {
      dispatch({ type: "setBlock", block: updatedBlock }, "local")
    },
    [dispatch]
  )

  const updateBlockV2 = useCallback(
    (blockId: string, blockData: Partial<Block>) => {
      dispatch({ type: "patchBlock", blockId, patch: blockData }, "local")
    },
    [dispatch]
  )

  const getBlockSnapshot = useCallback(
    (id: string) => {
      const b = store.getBlock(id)
      if (!b) throw new Error(`Block "${id}" does not exist`)
      return b
    },
    [store]
  )

  const blocks = store.getBlocks()

  const canEditBlockText = useCallback(
    (blockId: string) => {
      const collab = collaboration ?? null
      if (!collab) return true
      return canInteractWithBlockText({
        clientId: collab.clientId,
        presence: collab.presence,
        blockId,
        liveLocalFocusedBlockId: focusedBlockId
      })
    },
    [collaboration, focusedBlockId]
  )

  const value = useMemo<BlocksContextValue>(
    () => ({
      dispatch,
      blocks,
      blocksOrder,
      focusedBlockId,
      movingBlockId,
      shouldUpdate,
      setShouldUpdate,
      selectedBlockId,
      setSelectedBlockId,
      setMovingBlockId,
      setFocusedBlockId,
      insertBlock,
      updateBlock,
      turnBlockInto,
      splitBlock,
      mergeBlock,
      removeBlock,
      moveBlock,
      getBlockSnapshot,
      updateBlockV2,
      textBasedBlocks,
      blockTypes,
      canEditBlockText,
      collaboration: collaboration ?? null
    }),
    [
      dispatch,
      blocks,
      blocksOrder,
      focusedBlockId,
      movingBlockId,
      selectedBlockId,
      shouldUpdate,
      textBasedBlocks,
      blockTypes,
      collaboration,
      insertBlock,
      splitBlock,
      mergeBlock,
      removeBlock,
      moveBlock,
      turnBlockInto,
      updateBlock,
      updateBlockV2,
      getBlockSnapshot,
      canEditBlockText
    ]
  )

  return (
    <BlocksStoreContext.Provider value={store}>
      <BlocksContext.Provider value={value}>{children}</BlocksContext.Provider>
    </BlocksStoreContext.Provider>
  )
}

export { BlocksContext, BlocksProvider, BlocksStore, useBlock, useBlocksContext, useBlocksStore }
