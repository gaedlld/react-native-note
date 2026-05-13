import {
  Children,
  type ComponentType,
  type ReactNode,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef
} from "react"

import { Block, type BlockOptionsProps, type BlockProps } from "./Block"

export interface RegisteredBlock {
  component: ComponentType<{ blockId: string }>
  options?: BlockOptionsProps
}

export type BlockTypesMap = Record<string, RegisteredBlock>

interface BlockRegistrationProviderProps {
  blockTypes: BlockTypesMap
  textBasedBlocks: string[]
  defaultBlockType: string
}

const BlockRegistrationContext = createContext<BlockRegistrationProviderProps | null>(null)

export function useBlockRegistrationContext(): BlockRegistrationProviderProps {
  const context = useContext(BlockRegistrationContext)
  if (context === null) {
    throw new Error("useBlockRegistrationContext must be used within a BlockRegistrationProvider")
  }
  return context
}

interface BlockRegistrationOwnProps {
  customBlocks: ReactNode
  defaultBlockType: string
  children: ReactNode
}

export function BlockRegistration(props: BlockRegistrationOwnProps) {
  const { customBlocks, defaultBlockType, children } = props

  const blocksMapRef = useRef<BlockTypesMap>({})
  const textBasedBlocksRef = useRef<string[]>([])
  const defaultBlockTypeRef = useRef<string>(defaultBlockType)

  const register = useCallback(
    ({
      type,
      component,
      options
    }: {
      type: string
      component: ComponentType<{ blockId: string }>
      options?: BlockOptionsProps
    }) => {
      blocksMapRef.current[type] = {
        component,
        options
      }
      if (options?.isTextBased) {
        textBasedBlocksRef.current = [...textBasedBlocksRef.current, type]
      }
    },
    []
  )

  Children.forEach(customBlocks, (child) => {
    if (isValidElement<BlockProps>(child)) {
      if (child.type === Block) {
        register(child.props)
      } else {
        console.warn("Invalid")
      }
    }
  })

  const value = useMemo<BlockRegistrationProviderProps>(
    () => ({
      blockTypes: blocksMapRef.current,
      textBasedBlocks: textBasedBlocksRef.current,
      defaultBlockType: defaultBlockTypeRef.current
    }),
    []
  )

  return (
    <BlockRegistrationContext.Provider value={value}>{children}</BlockRegistrationContext.Provider>
  )
}
