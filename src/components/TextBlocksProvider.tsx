import React from "react"
import { TextInput } from "react-native"

import { useBlockRegistrationContext } from "./BlockRegistration"

export interface TextInputApi {
  getText: () => string
  setText: (text: string) => void
  focus: () => void
  blur: () => void
  setSelection: (selection: { start: number; end: number }) => void
  focusWithSelection: (selection: { start: number; end: number }, text?: string) => void
  getPosition: () => void
}

export type InputRefMap = Record<string, React.RefObject<TextInputApi>>

export interface TextBlocksContextValue {
  inputRefs: React.RefObject<InputRefMap>
  ghostInputRef: React.RefObject<TextInput | null>
  showSoftInputOnFocus: boolean
  setShowSoftInputOnFocus: (show: boolean) => void
  registerRef: (blockId: string, ref: React.RefObject<TextInputApi>) => void
  unregisterRef: (blockId: string) => void
  textBasedBlocks: string[]
}

const TextBlocksContext = React.createContext<TextBlocksContextValue | null>(null)

const useTextBlocksContext = (): TextBlocksContextValue => {
  const context = React.useContext(TextBlocksContext)
  if (context === null) {
    throw new Error("useTextBlocksContext must be used within a TextBlocksProvider")
  }
  return context
}

interface TextBlocksProviderProps {
  children: React.ReactNode
}

const TextBlocksProvider = ({ children }: TextBlocksProviderProps) => {
  const inputRefs = React.useRef<InputRefMap>({})
  const ghostInputRef = React.useRef<TextInput | null>(null)
  const [showSoftInputOnFocus, setShowSoftInputOnFocus] = React.useState(true)
  const { textBasedBlocks } = useBlockRegistrationContext()

  const registerRef: TextBlocksContextValue["registerRef"] = (blockId, ref) => {
    inputRefs.current[blockId] = ref
  }

  const unregisterRef: TextBlocksContextValue["unregisterRef"] = (blockId) => {
    delete inputRefs.current[blockId]
  }

  // The ghost input is a real TextInput, but consumers access it through the
  // same TextInputApi-shaped record as regular blocks. Wrap it so the
  // `setText`/`focus`/... surface stays consistent.
  const ghostApiRef = React.useRef<TextInputApi>({
    getText: () => "",
    setText: () => {},
    focus: () => ghostInputRef.current?.focus(),
    blur: () => ghostInputRef.current?.blur(),
    setSelection: () => {},
    focusWithSelection: () => {
      ghostInputRef.current?.focus()
    },
    getPosition: () => {}
  })

  const handleGhostInputOnLayout = () => {
    registerRef("ghostInput", ghostApiRef)
  }

  const value: TextBlocksContextValue = {
    inputRefs,
    ghostInputRef,
    showSoftInputOnFocus,
    setShowSoftInputOnFocus,
    registerRef,
    unregisterRef,
    textBasedBlocks
  }

  return (
    <TextBlocksContext.Provider value={value}>
      {children}
      <TextInput
        ref={ghostInputRef}
        onLayout={handleGhostInputOnLayout}
        caretHidden
        style={{
          position: "absolute",
          opacity: 0
        }}
      />
    </TextBlocksContext.Provider>
  )
}

export { TextBlocksProvider, useTextBlocksContext }
