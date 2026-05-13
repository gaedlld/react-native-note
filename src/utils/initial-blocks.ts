import type { Block } from "../types/block"

export const blocksData: Record<string, Block> = {
  "1": {
    id: "1",
    type: "page",
    properties: {
      title: "Page"
    },
    content: ["2"],
    parent: ""
  },
  "2": {
    id: "2",
    type: "header",
    properties: {
      title: "Page"
    },
    content: [],
    parent: "1"
  }
}
