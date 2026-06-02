import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { loadTheme, saveTheme } from '../game/theme'
import type { ThemeId } from '../game/theme'

interface ThemeCtx {
  theme: ThemeId
  setTheme: (id: ThemeId) => void
}

const Ctx = createContext<ThemeCtx>({ theme: 'default', setTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => loadTheme())
  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id)
    saveTheme(id)
  }, [])
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx)
}
