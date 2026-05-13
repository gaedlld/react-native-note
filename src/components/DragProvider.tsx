/**
 * Maybe this component should be renamed to something like BlockGestureHandler
 * and be exported from the coree library so that users could decide whether fi theey want
 * a certain block to have the drag or longpressed gestures.
 */
import { type ReactNode, useRef } from "react"
import { Dimensions, View } from "react-native"
import {
  Gesture,
  GestureDetector,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload
} from "react-native-gesture-handler"
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { scheduleOnRN } from "react-native-worklets"

import { useBlocksContext } from "./BlocksContext"
import { useBlocksMeasuresContext } from "./BlocksMeasuresProvider"
import { useScrollContext } from "./ScrollProvider"

const { height: screenHeight } = Dimensions.get("screen")

// SCROLLING THRESHOLDS
const TOP_THRESHOLD = 100
const BOTTOM_THRESHOLD = screenHeight - 100

interface DragProviderProps {
  children: ReactNode
  blockId: string
}

type FoundBlock =
  | { blockId: string; closestTo: "start" | "end" }
  | { blockId: null; closestTo: null }

export function DragProvider({ children, blockId }: DragProviderProps) {
  const { movingBlockId, setMovingBlockId, moveBlock, blocks, setSelectedBlockId } =
    useBlocksContext()
  const {
    setOffset,
    isDragging,
    setIsDragging,
    setStartPosition,
    indicatorPosition,
    setIndicatorPosition,
    blockMeasuresRef
  } = useBlocksMeasuresContext()
  const { scrollY, handleScrollTo } = useScrollContext()
  const insets = useSafeAreaInsets()

  const scrollDirection = useSharedValue<null | "UP" | "DOWN">(null)

  /** Auto scroll interval */
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const scrollUp = () => {
    handleScrollTo({ y: scrollY.value - 200, animated: true })
  }

  const scrollDown = () => {
    handleScrollTo({ y: scrollY.value + 200, animated: true })
  }

  const startAutoScrollUp = () => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(scrollUp, 100)
  }

  /** Stop scrolling */
  const stopAutoScroll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      scrollDirection.value = null
    }
  }

  const startAutoScrollDown = () => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(scrollDown, 100)
  }

  useAnimatedReaction(
    () => {
      return {
        scrollDirection: scrollDirection.value,
        isDragging: isDragging.value
      }
    },
    (currentValue) => {
      if (currentValue.scrollDirection === "UP") {
        scheduleOnRN(startAutoScrollUp)
      }

      if (currentValue.scrollDirection === "DOWN") {
        scheduleOnRN(startAutoScrollDown)
      }

      if (currentValue.scrollDirection === null) {
        scheduleOnRN(stopAutoScroll)
      }

      if (currentValue.isDragging === false) {
        scheduleOnRN(stopAutoScroll)
      }
    }
  )

  /**
   *  Given a y coordinate, returns the block at that position and a "start" or "end"
   *  string that indicates if the position is closer to the start or end of the block.
   *
   * Note: Maybe this could be turned into a worklet? It would have to look something like this:
   * findBlockAtPosition = (blocksMeasures: object, y: number) reutns { blockId: string, closestTo: "start" | "end" }
   *
   * */

  const findBlockAtPosition = (y: number): FoundBlock => {
    for (const id in blockMeasuresRef.current) {
      const { start, end } = blockMeasuresRef.current[id]
      if (y >= start && y <= end) {
        const closestTo: "start" | "end" = y - start > end - y ? "end" : "start"

        return { blockId: id, closestTo }
      }
    }

    return { blockId: null, closestTo: null }
  }

  const handleMoveBlock = () => {
    if (!movingBlockId) return

    const blockToMove = blocks[movingBlockId]
    const targetBlock = findBlockAtPosition(indicatorPosition.value.y + scrollY.value)
    if (
      targetBlock.blockId !== null &&
      targetBlock.closestTo !== null &&
      blockToMove.id !== targetBlock.blockId
    ) {
      moveBlock(blockToMove.id, blockToMove.parent, targetBlock.blockId, targetBlock.closestTo)
    }
  }

  const handleOnDragStart = () => {
    setIsDragging(true)
    setMovingBlockId(blockId)
    const measure = blockMeasuresRef.current[blockId]
    measure?.ref?.current?.measureInWindow((x: number, y: number) => {
      setStartPosition({ x, y })
    })
  }

  const handleOnDragUpdate = (e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
    /** Update scroll direction */
    if (e.absoluteY > BOTTOM_THRESHOLD) {
      scrollDirection.value = "DOWN"
    } else if (e.absoluteY < TOP_THRESHOLD) {
      scrollDirection.value = "UP"
    } else {
      scrollDirection.value = null
    }

    setOffset({
      x: e.translationX,
      y: e.translationY - insets.top
    })

    /** Update indicator position */
    const found = findBlockAtPosition(e.absoluteY - insets.top + scrollY.value)

    if (found.blockId !== null && found.closestTo !== null) {
      setIndicatorPosition({
        y: blockMeasuresRef.current[found.blockId][found.closestTo] - scrollY.value
      })
    }
  }

  const handleOnDragEnd = () => {
    handleMoveBlock()
    setIsDragging(false)
    setMovingBlockId(null)
    setOffset({ x: 0, y: 0 })
    setStartPosition({ x: 0, y: 0 })
    setIndicatorPosition({ y: 0 })
  }

  const nativeGestures = Gesture.Native()

  const longPress = Gesture.LongPress()
    .minDuration(2000)
    .onStart(() => {
      scheduleOnRN(setSelectedBlockId, blockId)
    })

  const blockDrag = Gesture.Pan()
    .activateAfterLongPress(1000)
    .minDistance(50)
    .onStart(() => {
      scheduleOnRN(handleOnDragStart)
    })
    .onUpdate((e) => {
      scheduleOnRN(handleOnDragUpdate, e)
    })
    .onFinalize(() => {
      scheduleOnRN(handleOnDragEnd)
    })
    .blocksExternalGesture(nativeGestures)

  const composed = Gesture.Simultaneous(nativeGestures, longPress, blockDrag)

  return (
    <GestureDetector gesture={composed}>
      <View>{children}</View>
    </GestureDetector>
  )
}
