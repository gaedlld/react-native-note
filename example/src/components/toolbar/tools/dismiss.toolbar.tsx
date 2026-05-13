import { SymbolView } from "expo-symbols"

import { StyleSheet, TouchableOpacity } from "react-native"
import { KeyboardController } from "react-native-keyboard-controller"
import { useBlocksContext, useTextBlocksContext } from "react-native-note"

import { useToolbarContext } from "../context.toolbar"

export function DismissKeyboardTool() {
  const { setHidden, setActiveTab } = useToolbarContext()
  const { setShowSoftInputOnFocus } = useTextBlocksContext()
  const { setFocusedBlockId } = useBlocksContext()

  const handleOnPress = () => {
    setShowSoftInputOnFocus(true)
    setHidden(true)
    setActiveTab("none")
    setFocusedBlockId(null)
    void KeyboardController.dismiss()
  }

  return (
    <TouchableOpacity onPress={handleOnPress} style={styles.container}>
      <SymbolView
        name={{ ios: "keyboard.chevron.compact.down", android: "keyboard_hide" }}
        tintColor="#007AFF"
        size={32}
      />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8
  }
})
