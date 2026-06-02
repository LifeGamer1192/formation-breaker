import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './ui/ThemeContext'
import { applySavedModOnBoot } from './game/mod'

// α16: 永続化された Mod があれば、描画前にカタログへ適用
applySavedModOnBoot()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
