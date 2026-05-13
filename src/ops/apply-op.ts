import { BlocksStore } from "../store/BlocksStore"
import { applyDeltas } from "../text/deltas"
import type { CreateBlockInput } from "../types/block"
import { insertBlockIdIntoContent, updateBlockData } from "../utils/block-helpers"
import { createBlock } from "../utils/create-block"
import type { ApplyOpContext, ApplyOpResult, Op } from "./types"

function computeFlatOrder(store: BlocksStore): string[] {
  const blocks = store.getBlocks()
  const rootContent = blocks["root"]?.content ?? []
  if (rootContent.length === 0) return []
  const firstId = rootContent[0]
  if (!firstId) return []
  const firstChild = blocks[firstId]
  if (!firstChild) return []
  return [firstId, ...(firstChild?.content ?? [])]
}

/**
 * Pure reducer: applies one op to the store. Idempotent only if ops are applied
 * in order; callers are responsible for conflict handling upstream.
 */
export function applyOp(store: BlocksStore, op: Op, ctx: ApplyOpContext): ApplyOpResult {
  switch (op.type) {
    case "insert": {
      const { block, position } = op
      const parent = store.getBlock(block.parent)
      if (!parent) return { kind: "none" }
      const updatedParent = updateBlockData(parent, {
        content: insertBlockIdIntoContent([...parent.content], block.id, {
          prevBlockId: position?.prevBlockId,
          nextBlockId: position?.nextBlockId
        })
      })
      store.setBlock(updatedParent.id, updatedParent)
      store.setBlock(block.id, block)
      store.setOrder(computeFlatOrder(store))
      return { kind: "none" }
    }

    case "remove": {
      const block = store.getBlock(op.blockId)
      if (!block) return { kind: "none" }
      const parentBlock = store.getBlock(block.parent)
      if (parentBlock) {
        const updatedParentBlock = updateBlockData(parentBlock, {
          content: parentBlock.content.filter((id) => id !== op.blockId)
        })
        store.setBlock(parentBlock.id, updatedParentBlock)
      }
      store.deleteBlock(op.blockId)
      store.setOrder(store.getOrder().filter((id) => id !== op.blockId))
      return { kind: "none" }
    }

    case "move": {
      const { blockId, parentId, targetId, closestTo } = op
      const parent = store.getBlock(parentId)
      if (!parent) return { kind: "none" }
      const nextContent = parent.content.filter((id) => id !== blockId)
      const updatedBlock = updateBlockData(parent, {
        content: insertBlockIdIntoContent(
          nextContent,
          blockId,
          closestTo === "start" ? { nextBlockId: targetId } : { prevBlockId: targetId }
        )
      })
      store.setBlock(parentId, updatedBlock)
      store.setOrder(computeFlatOrder(store))
      return { kind: "none" }
    }

    case "merge": {
      const sourceBlock = store.getBlock(op.sourceBlockId)
      const targetBlock = store.getBlock(op.targetBlockId)
      const sourceParent = sourceBlock ? store.getBlock(sourceBlock.parent) : undefined
      if (!sourceBlock || !targetBlock || !sourceParent) {
        throw new Error("merge: source, target, or parent missing")
      }
      const sourceBlockText = sourceBlock.properties.title
      const targetBlockText = targetBlock.properties.title

      const updatedTargetBlock = updateBlockData(targetBlock, {
        properties: {
          title: targetBlockText + sourceBlockText
        }
      })

      const updatedParentBlock = updateBlockData(sourceParent, {
        content: sourceParent.content.filter((id) => id !== sourceBlock.id)
      })

      store.setBlock(updatedTargetBlock.id, updatedTargetBlock)
      store.setBlock(updatedParentBlock.id, updatedParentBlock)
      store.setOrder(store.getOrder().filter((id) => id !== sourceBlock.id))

      return {
        kind: "merge",
        prevTitle: sourceBlockText,
        newTitle: updatedTargetBlock.properties.title,
        mergeResult: updatedTargetBlock
      }
    }

    case "split": {
      const block = store.getBlock(op.blockId)
      if (!block) throw new Error(`split: block "${op.blockId}" missing`)

      const textBeforeSelection = block.properties.title.substring(0, op.selection.start)
      const textAfterSelection = block.properties.title.substring(op.selection.end)

      const newBlockInput: CreateBlockInput = {
        type: block.type,
        properties: { title: textBeforeSelection },
        parent: block.parent,
        content: block.content
      }
      const newBlock = createBlock(newBlockInput)

      const order = store.getOrder()
      const isFirstVisibleBlock = order[0] === block.id

      const updatedBlock = updateBlockData(block, {
        type: ctx.defaultBlockType,
        properties: {
          title: textAfterSelection
        },
        content: [],
        parent: isFirstVisibleBlock ? newBlock.id : block.parent
      })

      store.setBlock(updatedBlock.id, updatedBlock)
      store.setBlock(newBlock.id, newBlock)

      if (isFirstVisibleBlock) {
        const parent = store.getBlock(block.parent)
        if (parent) {
          const updatedParentBlock = updateBlockData(parent, {
            content: [newBlock.id]
          })
          store.setBlock(updatedParentBlock.id, updatedParentBlock)
        }
        store.setOrder([newBlock.id, ...store.getOrder()])
      } else {
        store.setOrder(
          insertBlockIdIntoContent([...store.getOrder()], newBlock.id, {
            nextBlockId: block.id
          })
        )
      }

      return {
        kind: "split",
        prevBlock: newBlock,
        nextBlock: updatedBlock
      }
    }

    case "turnInto": {
      const current = store.getBlock(op.blockId)
      if (!current) throw new Error(`Block "${op.blockId}" does not exist`)
      const updatedBlock = updateBlockData(current, { type: op.blockType })
      store.setBlock(updatedBlock.id, updatedBlock)
      return { kind: "turnInto", block: updatedBlock }
    }

    case "setBlock": {
      store.setBlock(op.block.id, op.block)
      return { kind: "none" }
    }

    case "patchBlock": {
      store.patchBlock(op.blockId, op.patch)
      return { kind: "none" }
    }

    case "text": {
      const cur = store.getBlock(op.blockId)
      if (!cur) return { kind: "none" }
      const nextTitle = applyDeltas(cur.properties.title, op.deltas)
      store.patchBlock(op.blockId, {
        properties: { ...cur.properties, title: nextTitle }
      })
      return { kind: "none" }
    }

    default: {
      const _exhaustive: never = op
      return _exhaustive
    }
  }
}
