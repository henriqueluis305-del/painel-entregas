"use client"

import { useCallback, useSyncExternalStore } from "react"

export const THEMES = ["light", "dark", "blue"] as const
export type Theme = (typeof THEMES)[number]
export const THEME_STORAGE_KEY = "theme"
const DEFAULT_THEME: Theme = "dark"
// Evento próprio: o "storage" do browser não dispara na mesma aba.
const THEME_EVENT = "spott:themechange"

function isTheme(v: string | null): v is Theme {
  return !!v && (THEMES as readonly string[]).includes(v)
}

/** Lê o tema atual do localStorage (client). */
function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(v)) return v
  } catch {
    /* localStorage indisponível */
  }
  return DEFAULT_THEME
}

/** Aplica o tema no <html>, igual ao script no-flash do <head> do layout. */
function applyTheme(theme: Theme) {
  const el = document.documentElement
  el.classList.remove(...THEMES)
  el.classList.add(theme)
  el.style.colorScheme = theme === "light" ? "light" : "dark"
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(THEME_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(THEME_EVENT, onChange)
  }
}

/**
 * Provider de tema mínimo. Substitui o next-themes (que injetava um <script>
 * inline dentro de um client component, o que o React 19 avisa no console).
 * O no-flash vem do script no <head> do layout; aqui só expomos o estado.
 * Sem context: cada consumidor assina o localStorage via useSyncExternalStore.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function useTheme(): {
  theme: Theme
  setTheme: (theme: string) => void
  themes: readonly Theme[]
} {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME)

  const setTheme = useCallback((next: string) => {
    if (!isTheme(next)) return
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* localStorage indisponível */
    }
    applyTheme(next)
    window.dispatchEvent(new Event(THEME_EVENT))
  }, [])

  return { theme, setTheme, themes: THEMES }
}
