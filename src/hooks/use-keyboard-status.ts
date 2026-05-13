import { useEffect, useState } from "react"
import { KeyboardEvents } from "react-native-keyboard-controller"

/**
 * Keyboard visibility and layout from react-native-keyboard-controller (`useKeyboardState`).
 * Requires KeyboardProvider — Editor wraps children with it automatically.
 */
export function useKeyboardStatus() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const keyboardWillShowListener = KeyboardEvents.addListener("keyboardWillShow", (e) => {
      setIsKeyboardOpen(true)
      setKeyboardHeight(e.height)
    })
    const keyboardDidHideListener = KeyboardEvents.addListener("keyboardDidHide", () => {
      setIsKeyboardOpen(false)
    })

    return () => {
      keyboardWillShowListener.remove()
      keyboardDidHideListener.remove()
    }
  }, [])

  return {
    isKeyboardOpen,
    keyboardHeight
  }
}
