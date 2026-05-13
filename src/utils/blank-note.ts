import type { Block } from "../types/block"

export const blankNote: Record<string, Block> = {
  "1": {
    id: "1",
    type: "page",
    properties: {
      title: ""
    },
    content: [],
    parent: ""
  }
}
