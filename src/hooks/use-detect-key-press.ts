import { useState } from "react"
import { type TextInputKeyPressEvent } from "react-native"

interface Params {
  key: string
  target?: "keydown" | "keyup"
}

export function useDetectKeyPress({ key }: Params) {
  const [isPressed, setIsPressed] = useState(false)

  const handleKeyPress = ({ nativeEvent }: TextInputKeyPressEvent) => {
    if (nativeEvent.key === key) {
      setIsPressed(true)
      console.log("Delete or Backspace key pressed!")
    } else {
      setIsPressed(false)
    }
  }

  return {
    isPressed,
    handleKeyPress
  }
}
