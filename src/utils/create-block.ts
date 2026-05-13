import { v4 } from "uuid"

import type { Block, CreateBlockInput } from "../types/block"

export const createBlock = (block: CreateBlockInput): Block => {
  return {
    id: block.id ?? v4(),
    type: block.type,
    properties: block.properties,
    format: block.format,
    content: block.content ?? [],
    parent: block.parent
  }
}
