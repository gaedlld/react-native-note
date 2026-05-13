import React, { useCallback, useLayoutEffect, useSyncExternalStore } from "react"
import {
  TextInput,
  type TextInputKeyPressEvent,
  type TextInputProps,
  type TextInputSelectionChangeEvent
} from "react-native"

import { useBlockRegistrationContext } from "../components/BlockRegistration"
import { useBlocksContext, useBlocksStore } from "../components/BlocksContext"
import { useBlocksMeasuresContext } from "../components/BlocksMeasuresProvider"
import { useScrollContext } from "../components/ScrollProvider"
import { type TextInputApi, useTextBlocksContext } from "../components/TextBlocksProvider"
import { singleEditDelta } from "../text/deltas"
import {
  findPrevTextBlockInContent,
  getPreviousBlockInContent,
  updateBlockData
} from "../utils/block-helpers"

export function useTextInput(blockId: string) {
  const {
    blocks,
    blocksOrder,
    focusedBlockId,
    setFocusedBlockId,
    dispatch,
    updateBlock,
    mergeBlock,
    splitBlock,
    removeBlock,
    getBlockSnapshot,
    canEditBlockText
  } = useBlocksContext()
  const store = useBlocksStore()
  const { registerRef, showSoftInputOnFocus, inputRefs } = useTextBlocksContext()
  const { isScrolling } = useScrollContext()
  const { isBlockDragActive } = useBlocksMeasuresContext()
  const { textBasedBlocks, defaultBlockType } = useBlockRegistrationContext()

  const block = getBlockSnapshot(blockId)
  const title = block.properties.title
  const inputRef = React.useRef<TextInput | null>(null)
  const selectionRef = React.useRef({ start: title.length, end: title.length })
  const valueRef = React.useRef(title)
  const isFocused = focusedBlockId === blockId
  const isEditable =
    canEditBlockText(blockId) &&
    (isScrolling === false && !isBlockDragActive ? true : focusedBlockId === blockId)

  const subscribeTitle = useCallback(
    (listener: () => void) => store.subscribeBlock(blockId, listener),
    [store, blockId]
  )
  const getTitleSnapshot = useCallback(
    () => store.getBlock(blockId)?.properties.title ?? "",
    [store, blockId]
  )
  const storeTitle = useSyncExternalStore(subscribeTitle, getTitleSnapshot, getTitleSnapshot)

  const api = React.useRef<TextInputApi>({
    getText: () => valueRef.current,
    setText: (text: string) => {
      valueRef.current = text
      inputRef.current?.setNativeProps({ text: valueRef.current })
    },
    focus: () => {
      inputRef.current?.focus()
    },
    blur: () => {
      inputRef.current?.blur()
    },
    setSelection: (selection: { start: number; end: number }) => {
      inputRef.current?.setSelection(selection.start, selection.end)
      selectionRef.current = selection
    },
    focusWithSelection: (selection: { start: number; end: number }, text?: string) => {
      if (text !== undefined) {
        inputRef.current?.setNativeProps({ text })
      }

      inputRef.current?.setSelection(selection.start, selection.end)
      selectionRef.current = selection
      inputRef.current?.focus()
    },
    getPosition: () => {
      inputRef.current?.measureInWindow((x, y, width, height) => {
        console.log(x, y, width, height)
      })
    }
  })

  function handleSelectionChange(event: TextInputSelectionChangeEvent) {
    selectionRef.current = event.nativeEvent.selection
  }

  function handleOnBlur() {
    const snap = getBlockSnapshot(blockId)
    if (snap.properties.title === valueRef.current) return
    const updatedBlock = updateBlockData(snap, {
      properties: {
        title: valueRef.current
      }
    })
    updateBlock(updatedBlock)
  }

  function handleOnKeyPress(_event: TextInputKeyPressEvent) {
    const block = updateBlockData(getBlockSnapshot(blockId), {
      properties: {
        title: valueRef.current
      }
    })

    if (blocksOrder[0] === blockId) return

    const sourceBlock = block
    const prevTextBlock = findPrevTextBlockInContent(blockId, blocks, textBasedBlocks)
    const prevBlock = getPreviousBlockInContent(blockId, blocks)
    const targetBlockId = prevTextBlock === undefined ? sourceBlock.parent : prevTextBlock.id

    if (
      getBlockSnapshot(targetBlockId).properties.title.length === 0 &&
      targetBlockId !== sourceBlock.parent &&
      prevBlock?.type === defaultBlockType
    ) {
      requestAnimationFrame(() => {
        removeBlock(targetBlockId)
      })
    } else {
      const { mergeResult } = mergeBlock(block, targetBlockId)

      const mergedRef = inputRefs.current[mergeResult.id]
      mergedRef?.current?.setText(mergeResult.properties.title)
      mergedRef?.current?.setSelection({
        start: mergeResult.properties.title.length - sourceBlock.properties.title.length,
        end: mergeResult.properties.title.length - sourceBlock.properties.title.length
      })
      mergedRef?.current?.focus()
    }
  }

  const handleSubmitEditing = () => {
    const block = updateBlockData(getBlockSnapshot(blockId), {
      properties: {
        title: valueRef.current
      }
    })
    const selection = selectionRef.current

    if (block.type !== defaultBlockType) {
      inputRefs.current["ghostInput"]?.current?.focus()
    }

    const { nextBlock } = splitBlock(block, selection)

    inputRefs.current[nextBlock.id]?.current?.setText(nextBlock.properties.title)
    setTimeout(() => {
      inputRefs.current[nextBlock.id]?.current?.setSelection({
        start: 0,
        end: 0
      })
      inputRefs.current[nextBlock.id]?.current?.focus()
    }, 0)
  }

  const handleOnFocus = () => {
    setFocusedBlockId(blockId)
  }

  const handleChangeText = (text: string) => {
    const prev = valueRef.current
    valueRef.current = text
    const deltas = singleEditDelta(prev, text)
    if (deltas.length > 0) {
      dispatch({ type: "text", blockId, deltas }, "local")
    }
  }

  React.useEffect(() => {
    if (isFocused) return
    if (storeTitle === valueRef.current) return
    valueRef.current = storeTitle
    inputRef.current?.setNativeProps({ text: storeTitle })
    const len = storeTitle.length
    selectionRef.current = { start: len, end: len }
  }, [storeTitle, isFocused])

  const getTextInputProps: () => TextInputProps = () => {
    return {
      ref: inputRef,
      defaultValue: valueRef.current,
      scrollEnabled: false,
      multiline: true,
      selectionColor: "black",
      submitBehavior: "submit",
      selectTextOnFocus: false,
      smartInsertDelete: false,
      editable: isEditable,

      onSelectionChange: handleSelectionChange,
      showSoftInputOnFocus: showSoftInputOnFocus,
      onChangeText: handleChangeText,
      onBlur: handleOnBlur,
      onFocus: handleOnFocus,
      onSubmitEditing: handleSubmitEditing,
      onKeyPress: (event) => {
        if (
          event.nativeEvent.key === "Backspace" &&
          selectionRef.current.start === 0 &&
          selectionRef.current.end === 0
        ) {
          handleOnKeyPress(event)
        }
      }
    }
  }

  useLayoutEffect(() => {
    registerRef(blockId, api)
  }, [blockId, registerRef])

  useLayoutEffect(() => {
    if (title.length !== 0) return
    const node = inputRef.current
    if (!node) return
    /**
     * PATCH: Know issue on latest react-native version.
     * [#52854](https://github.com/facebook/react-native/issues/52854)
     */
    node.setNativeProps({ text: " " })
    node.setNativeProps({ text: "" })
  }, [title.length, blockId])

  return {
    getTextInputProps,
    isFocused,
    getValue: () => valueRef.current,
    getSelection: () => selectionRef.current
  }
}
