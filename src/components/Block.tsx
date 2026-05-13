import { type ComponentType } from "react"

interface BlockOptionsProps {
  isTextBased?: boolean
  name?: string
  [key: string]: unknown
}

interface BlockProps {
  type: string
  component: ComponentType<{ blockId: string }>
  options?: BlockOptionsProps
}

const Block = (_props: BlockProps) => {
  return null
}

export { Block, type BlockOptionsProps, type BlockProps }
