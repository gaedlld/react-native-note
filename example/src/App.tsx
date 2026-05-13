import { StatusBar } from "expo-status-bar"

import { useCallback, useMemo, useRef, useState } from "react"
import { Pressable, Switch, Text, View } from "react-native"
import {
  Block,
  type BlockData,
  type BlocksTransport,
  type ClientSingleWriterCollaboration,
  type CollaboratorsPresence,
  Editor,
  type Op,
  type RemoteFocusIndicatorProps,
  canonicalWriterForBlock,
  createBlock,
  mergeLocalWriterPresence
} from "react-native-note"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

import { BulletBlock } from "./components/blocks/BulletBlock"
import { CheckboxBlock } from "./components/blocks/CheckboxBlock"
import { HeaderBlock } from "./components/blocks/HeaderBlock"
import { ImageBlock } from "./components/blocks/ImageBlock"
import { PageBlock } from "./components/blocks/PageBlock"
import { QuoteBlock } from "./components/blocks/QuoteBlock"
import { SubHeaderBlock } from "./components/blocks/SubHeaderBlock"
import { SubSubHeaderBlock } from "./components/blocks/SubSubHeaderBlock"
import { TextBlock } from "./components/blocks/TextBlock"
import { OwnPresenceSync } from "./components/own-presence-sync"
import { ToolbarContextProvider } from "./components/toolbar/context.toolbar"
import { Toolbar } from "./components/toolbar/toolbar"

const initialBlocks: Record<string, BlockData> = {
  "1": {
    id: "1",
    type: "page",
    properties: {
      title: "Hello World"
    },
    content: ["2"],
    parent: "root"
  },
  "2": {
    id: "2",
    type: "text",
    properties: {
      title: "Second block"
    },
    content: [],
    parent: "1"
  }
}

/** Lexicographically smaller id wins when two collaborators claim the same block. */
const SIMULATED_PEER_ID = "aaa-peer"

export default function App() {
  const clientId = "local-user"
  const [ownFocusedBlockId, setOwnFocusedBlockId] = useState<string | null>(null)
  const [simulatePeerOnPage, setSimulatePeerOnPage] = useState(false)

  const mergeOwnPresence = useCallback(
    (id: string, focusedBlockId: string | null) => {
      if (id !== clientId) return
      setOwnFocusedBlockId(focusedBlockId)
    },
    [clientId]
  )

  /** Remote collaborators only — core merges `clientId` + live editor focus. */
  const presence = useMemo<CollaboratorsPresence>(() => {
    const map: CollaboratorsPresence = {}
    if (simulatePeerOnPage) {
      map[SIMULATED_PEER_ID] = { focusedBlockId: "2" }
    }
    return map
  }, [simulatePeerOnPage])

  const collaboration = useMemo<ClientSingleWriterCollaboration>(
    () => ({ clientId, presence }),
    [clientId, presence]
  )

  const canonicalOnPage = canonicalWriterForBlock(
    mergeLocalWriterPresence(collaboration, ownFocusedBlockId),
    "1"
  )

  const extractBlocks = (blocks: Record<string, BlockData>) => {
    console.log("blocks", blocks)
  }

  /** Apply inbound ops from your sync layer (websocket, InstantDB, …). */
  const replayRemoteRef = useRef<(op: Op) => void>(() => {})

  const transport = useMemo<BlocksTransport>(
    () => ({
      send(op) {
        console.log("[collab] outbound", op)
      },
      connect(api) {
        replayRemoteRef.current = (op) => {
          api.dispatch(op, "remote")
        }
        return () => {
          replayRemoteRef.current = () => {}
        }
      }
    }),
    []
  )

  const renderRemoteFocusIndicator = useCallback(({ remotePeerIds }: RemoteFocusIndicatorProps) => {
    if (remotePeerIds.length === 0) return null
    return (
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 8,
          right: 4,
          zIndex: 20,
          backgroundColor: "#2383e2",
          borderRadius: 12,
          paddingHorizontal: 8,
          paddingVertical: 4
        }}
      >
        <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
          {remotePeerIds.length === 1
            ? remotePeerIds[0]!.slice(0, 10)
            : `${remotePeerIds.length} others`}
        </Text>
      </View>
    )
  }, [])

  const ToolbarComponent = useCallback(
    () => (
      <ToolbarContextProvider>
        <OwnPresenceSync clientId={clientId} onOwnFocusedBlockChange={mergeOwnPresence} />

        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            gap: 8,
            borderBottomWidth: 1,
            borderBottomColor: "#00000014"
          }}
        >
          <Text style={{ fontSize: 12, opacity: 0.75 }}>
            Client-only single-writer: presence drives who may emit{" "}
            <Text style={{ fontFamily: "monospace" }}>text</Text> ops on a block. Turn on the peer
            switch to see the remote-focus badge on page block "1". Canonical writer for page block
            "1":{" "}
            <Text style={{ fontWeight: "600" }}>
              {canonicalOnPage ?? "none (solo — you can edit)"}
            </Text>
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <Text style={{ fontSize: 13, flex: 1, paddingRight: 12 }}>
              Simulate peer "{SIMULATED_PEER_ID}" focused on page (wins tie-break → you read-only on
              title while both claim it)
            </Text>
            <Switch value={simulatePeerOnPage} onValueChange={setSimulatePeerOnPage} />
          </View>

          <Pressable
            onPress={() => {
              replayRemoteRef.current({
                type: "text",
                blockId: "1",
                deltas: [{ retain: 11 }, { insert: "!" }]
              })
            }}
            style={{
              paddingVertical: 8,
              alignSelf: "flex-start"
            }}
          >
            <Text style={{ fontSize: 13, opacity: 0.7 }}>
              Demo: simulate remote text op (append ! to page title — only applies when you are not
              the canonical writer)
            </Text>
          </Pressable>
        </View>

        <Toolbar />
      </ToolbarContextProvider>
    ),
    [simulatePeerOnPage, mergeOwnPresence, clientId, canonicalOnPage]
  )

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <Editor
          defaultBlocks={initialBlocks}
          extractBlocks={extractBlocks}
          transport={transport}
          collaboration={collaboration}
          ToolbarComponent={ToolbarComponent}
          renderRemoteFocusIndicator={renderRemoteFocusIndicator}
          // Deprecate
          defaultBlockType={"text"}
          showPageIconAndCover={false}
          onBlankSpacePress={({ blocks, blocksOrder, inputRefs, insertBlock }) => {
            const rootBlockId = blocks["root"].content[0]
            const rootBlock = blocks[rootBlockId]
            const lastBlockId = blocksOrder[blocksOrder.length - 1]

            if (
              blocks[lastBlockId].type === "text" &&
              blocks[lastBlockId].properties?.title.length === 0
            ) {
              inputRefs.current[rootBlock.content[rootBlock.content.length - 1]]?.current?.focus()
            } else {
              const newBlock = createBlock({
                type: "text",
                properties: { title: "" },
                format: {},
                content: [],
                parent: rootBlock.id
              })

              insertBlock(newBlock)
              requestAnimationFrame(() => {
                inputRefs.current[newBlock.id]?.current?.focus()
              })
            }
          }}
        >
          <Block
            type="text"
            component={TextBlock}
            options={{
              isTextBased: true,
              name: "Text"
            }}
          />

          <Block
            type="header"
            component={HeaderBlock}
            options={{
              isTextBased: true,
              name: "Header 1"
            }}
          />

          <Block
            type="sub_header"
            component={SubHeaderBlock}
            options={{
              isTextBased: true,
              name: "Header 2"
            }}
          />

          <Block
            type="sub_sub_header"
            component={SubSubHeaderBlock}
            options={{
              isTextBased: true,
              name: "Header 3"
            }}
          />

          <Block
            type="page"
            component={PageBlock}
            options={{
              isTextBased: true,
              name: "Page"
            }}
          />

          <Block
            type="image"
            component={ImageBlock}
            options={{
              name: "Image"
            }}
          />

          <Block
            type="bullet"
            component={BulletBlock}
            options={{
              isTextBased: true,
              name: "Bulleted list"
            }}
          />

          <Block
            type="checkbox"
            component={CheckboxBlock}
            options={{
              isTextBased: true,
              name: "To-do list"
            }}
          />

          <Block
            type="quote"
            component={QuoteBlock}
            options={{
              isTextBased: true,
              name: "Quote"
            }}
          />
        </Editor>

        <StatusBar style="auto" />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
