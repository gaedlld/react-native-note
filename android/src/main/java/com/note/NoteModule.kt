package com.note

import com.facebook.react.bridge.ReactApplicationContext

class NoteModule(reactContext: ReactApplicationContext) :
  NativeNoteSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeNoteSpec.NAME
  }
}
