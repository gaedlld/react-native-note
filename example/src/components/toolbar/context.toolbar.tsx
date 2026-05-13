import { createContext, useContext, useState } from "react"

interface ToolbarContextValue {
  activeTab: string
  hidden: boolean
  setActiveTab: (tab: string) => void
  setHidden: (hidden: boolean) => void
}

const ToolbarContext = createContext<ToolbarContextValue>({
  activeTab: "none",
  hidden: true,
  setActiveTab: () => {},
  setHidden: () => {}
})

export const useToolbarContext = () => {
  const context = useContext(ToolbarContext)
  if (context === undefined) {
    throw new Error("useToolbarContext must be used within a ToolbarContextProvider")
  }
  return context
}

export const ToolbarContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeTab, setActiveTab] = useState("none")
  const [hidden, setHidden] = useState(true)

  return (
    <ToolbarContext.Provider value={{ activeTab, hidden, setActiveTab, setHidden }}>
      {children}
    </ToolbarContext.Provider>
  )
}
