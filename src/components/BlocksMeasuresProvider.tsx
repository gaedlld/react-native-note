import {
  type ReactNode,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState
} from "react"
import { Dimensions, StyleSheet, View, type ViewStyle } from "react-native"
import Animated, { SharedValue, useAnimatedStyle, useSharedValue } from "react-native-reanimated"

import { useBlockRegistrationContext } from "./BlockRegistration"
import { useBlocksContext } from "./BlocksContext"

const { width } = Dimensions.get("window")

export interface BlockMeasure {
  height: number
  width: number
  start: number
  end: number
  type?: string
  ref?: RefObject<View | null>
}

export interface BlockMeasuresContextValue {
  blockMeasuresRef: RefObject<Record<string, BlockMeasure>>
  registerBlockMeasure: (blockId: string, measures: BlockMeasure) => void
  removeBlockMeasure: (blockId: string) => void

  indicatorPosition: SharedValue<{ y: number }>
  setIndicatorPosition: (position: { y: number }) => void

  isDragging: SharedValue<boolean>
  /** Mirrors `isDragging` shared value for React reads — do not read `.value` during render. */
  isBlockDragActive: boolean
  setIsDragging: (isDragging: boolean) => void

  startPosition: SharedValue<{ x: number; y: number }>
  setStartPosition: (position: { x: number; y: number }) => void

  offset: SharedValue<{ x: number; y: number }>
  setOffset: (offset: { x: number; y: number }) => void
}

const BlocksMeasuresContext = createContext<BlockMeasuresContextValue | null>(null)

export function useBlocksMeasuresContext(): BlockMeasuresContextValue {
  const context = useContext(BlocksMeasuresContext)
  if (context === null) {
    throw new Error("useBlocksMeasuresContext must be used within a BlocksMeasuresProvider")
  }
  return context
}

interface BlocksMeasuresProviderProps {
  children: ReactNode
}

/**
 * Provider for block measures.
 * (Maybe good for refactoring): It also handles the animations for both the indicator and the ghost block when moving a block.
 */
export function BlocksMeasuresProvider({ children }: BlocksMeasuresProviderProps) {
  const blockMeasuresRef = useRef<Record<string, BlockMeasure>>({})
  const indicatorPosition = useSharedValue({ y: 0 })
  const { blockTypes } = useBlockRegistrationContext()
  const { movingBlockId, blocks } = useBlocksContext()

  const isDragging = useSharedValue(false)
  const [isBlockDragActive, setIsBlockDragActive] = useState(false)

  const setIsDragging = useCallback((value: boolean) => {
    isDragging.value = value
    setIsBlockDragActive(value)
  }, [])

  const registerBlockMeasure: BlockMeasuresContextValue["registerBlockMeasure"] = (
    blockId,
    measures
  ) => {
    blockMeasuresRef.current[blockId] = measures
  }

  const removeBlockMeasure: BlockMeasuresContextValue["removeBlockMeasure"] = (blockId) => {
    delete blockMeasuresRef.current[blockId]
  }

  const indicatorAnimatedStyles = useAnimatedStyle(() => {
    return {
      top: indicatorPosition.value.y,
      display: isDragging.value ? "flex" : "none"
    }
  })

  const Indicator = () => <Animated.View style={[styles.indicator, indicatorAnimatedStyles]} />

  // Ghost block
  /** NOTE: It might be better to separate this into its own provider. */
  // startPosition is where the GhostBlock should be absolutely positioned
  const startPosition = useSharedValue({ x: 0, y: 0 })
  // offset is how much the GhostBlock has moved from its start position
  const offset = useSharedValue({ x: 0, y: 0 })
  const animatedStyles = useAnimatedStyle(() => ({
    transform: [
      { scaleX: 1.01 },
      { scaleY: 1.01 },
      { translateX: offset.value.x },
      { translateY: offset.value.y }
    ] as ViewStyle["transform"],
    top: startPosition.value.y,
    left: startPosition.value.x,
    display: isDragging.value === false ? "none" : "flex"
  }))

  /**
   * NOTE: Ghost block only needs to look like the block that is being dragged,
   * but right now its mounting the whole component with all its logic, which is not necessary.
   * I'll leave it like this because its working, but it can be refactored in the future.
   */
  const GhostBlock = () => {
    if (!movingBlockId) return null
    const Component = blockTypes[blocks[movingBlockId]?.type ?? ""]?.component

    if (!Component) return null

    return (
      <Animated.View
        style={[
          {
            opacity: 0.5,
            position: "absolute",
            zIndex: 1000,
            width: "100%"
          },
          animatedStyles
        ]}
      >
        <Component blockId={movingBlockId} />
      </Animated.View>
    )
  }

  const values: BlockMeasuresContextValue = {
    blockMeasuresRef,
    registerBlockMeasure,
    removeBlockMeasure,

    setIsDragging,

    isDragging,
    isBlockDragActive,
    startPosition,
    setStartPosition: ({ x, y }: { x: number; y: number }) => (startPosition.value = { x, y }),
    offset,
    setOffset: ({ x, y }: { x: number; y: number }) => (offset.value = { x, y }),

    indicatorPosition,
    setIndicatorPosition: ({ y }: { y: number }) => (indicatorPosition.value = { y })
  }

  return (
    <BlocksMeasuresContext.Provider value={values}>
      {children}

      <Indicator />

      {isBlockDragActive && movingBlockId ? <GhostBlock /> : null}
    </BlocksMeasuresContext.Provider>
  )
}

const styles = StyleSheet.create({
  indicator: {
    height: 3,
    width: width - 32,
    marginLeft: 16,
    boxSizing: "border-box",
    opacity: 0.5,
    backgroundColor: "#0277e4ff",
    position: "absolute"
  }
})
