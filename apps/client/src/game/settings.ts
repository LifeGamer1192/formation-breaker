// ─── 設定（α19: 操作・UX）──────────────────────────────────────────
// localStorage 永続。ゲームセーブとは分離。

export interface Settings {
  battleSpeed: 1 | 2 | 4 | 8   // 戦闘の既定速度
  reduceMotion: boolean        // tick間補間を無効化（処理を軽く/酔い対策）
  tutorialSeen: boolean        // 初回チュートリアルを表示済みか
}

const KEY = 'fb-settings'
const DEFAULTS: Settings = { battleSpeed: 1, reduceMotion: false, tutorialSeen: false }

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw) as Partial<Settings>
    const sp = p.battleSpeed
    return {
      battleSpeed: (sp === 1 || sp === 2 || sp === 4 || sp === 8) ? sp : DEFAULTS.battleSpeed,
      reduceMotion: !!p.reduceMotion,
      tutorialSeen: !!p.tutorialSeen,
    }
  } catch { return { ...DEFAULTS } }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

export function patchSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch }
  saveSettings(next)
  return next
}
