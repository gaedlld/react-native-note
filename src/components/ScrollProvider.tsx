import { type ReactNode, createContext, useContext, useRef, useState } from "react"
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle
} from "react-native"
import { ScrollView } from "react-native-gesture-handler"
import { type SharedValue, useSharedValue } from "react-native-reanimated"

export interface ScrollContextValue {
  scrollY: SharedValue<number>
  isScrolling: boolean
  setIsScrolling: (value: boolean) => void
  handleScrollTo: (params: { x?: number; y?: number; animated?: boolean }) => void
}

const ScrollContext = createContext<ScrollContextValue | null>(null)

export const useScrollContext = (): ScrollContextValue => {
  const context = useContext(ScrollContext)
  if (context === null) {
    throw new Error("useScrollContext must be used within a ScrollProvider")
  }
  return context
}

interface ScrollProviderProps {
  children: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
}

export function ScrollProvider({ children, contentContainerStyle }: ScrollProviderProps) {
  const scrollViewRef = useRef<ScrollView>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollY = useSharedValue(0)

  const handleDragStart = () => {
    setIsScrolling(true)
  }

  const handleDragEnd = () => {
    setIsScrolling(false)
  }

  const handleOnScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = Math.round(event.nativeEvent.contentOffset.y)
  }

  const handleScrollTo: ScrollContextValue["handleScrollTo"] = ({ x, y, animated }) => {
    scrollViewRef.current?.scrollTo({ x, y, animated })
  }

  const value: ScrollContextValue = {
    scrollY,
    isScrolling,
    setIsScrolling,
    handleScrollTo
  }

  return (
    <ScrollContext.Provider value={value}>
      <ScrollView
        ref={scrollViewRef}
        onScroll={handleOnScroll}
        onScrollBeginDrag={handleDragStart}
        onScrollEndDrag={handleDragEnd}
        onMomentumScrollEnd={handleDragEnd}
        contentContainerStyle={[{ flexGrow: 1, paddingHorizontal: 8 }, contentContainerStyle]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="always"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </ScrollContext.Provider>
  )
}
