import { ScrollView, StyleSheet, View } from "react-native"
import { KeyboardExtender } from "react-native-keyboard-controller"

import { DismissKeyboardTool } from "./tools/dismiss.toolbar"

export function Toolbar() {
  return (
    <KeyboardExtender enabled>
      <View style={styles.container}>
        <ScrollView keyboardShouldPersistTaps="always" horizontal></ScrollView>
        <DismissKeyboardTool />
      </View>
    </KeyboardExtender>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    width: "100%",
    flexDirection: "row"
  }
})
