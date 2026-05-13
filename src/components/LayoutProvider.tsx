import { type ReactNode, useEffect, useRef } from "react"
import { View } from "react-native"

import { useBlocksContext } from "./BlocksContext"
import { useBlocksMeasuresContext } from "./BlocksMeasuresProvider"

interface LayoutProviderProps {
  children: ReactNode
  blockId: string
}

/** Measures and registers the height and position of a block */
export function LayoutProvider({ children, blockId }: LayoutProviderProps) {
  const { blocks } = useBlocksContext()
  const { registerBlockMeasure, removeBlockMeasure } = useBlocksMeasuresContext()
  const viewRef = useRef<View | null>(null)

  /** Maybe this computation could be workletized (?) */
  const handleOnLayout = () => {
    /**
     * Same story as with DragProvider.
     * This condition will be removed
     */
    if (blockId !== blocks["root"].content[0] && viewRef.current) {
      viewRef.current.measure((_x, y, width, height) => {
        registerBlockMeasure(blockId, {
          ref: viewRef,
          type: blocks[blockId].type,
          width,
          height,
          start: y,
          end: y + height
        })
      })
    }
  }

  useEffect(() => {
    handleOnLayout()

    return () => {
      removeBlockMeasure(blockId)
    }
  })

  return (
    <View ref={viewRef} onLayout={handleOnLayout}>
      {children}
    </View>
  )
}
