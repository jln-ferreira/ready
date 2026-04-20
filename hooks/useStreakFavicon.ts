'use client'

import { useEffect } from 'react'

const LS_KEY = 'ready_streak'

// Streak tiers: 2, 3, 4-9, 10+
function streakEmoji(streak: number): string | null {
  if (streak < 2)  return null   // default favicon
  if (streak < 3)  return '🌱'   // day 2 — just starting
  if (streak < 4)  return '🔥'   // day 3 — heating up
  if (streak < 10) return '⚡'   // days 4-9 — on fire
  return '👑'                     // 10+ — ultimate
}

function applyEmojiFavicon(emoji: string) {
  if (typeof document === 'undefined') return
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, 32, 32)
  ctx.font = '26px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, 16, 18)

  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/png'
  link.href = canvas.toDataURL()
}

function resetFavicon() {
  if (typeof document === 'undefined') return
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/x-icon'
  link.href = '/favicon.ico'
}

/** Call once on app boot to restore favicon from last known streak. */
export function restoreStreakFavicon() {
  if (typeof localStorage === 'undefined') return
  const stored = parseInt(localStorage.getItem(LS_KEY) ?? '0', 10)
  const emoji = streakEmoji(stored)
  if (emoji) applyEmojiFavicon(emoji)
}

/** Hook: updates favicon whenever `streak` changes and persists it to localStorage. */
export function useStreakFavicon(streak: number) {
  useEffect(() => {
    const emoji = streakEmoji(streak)
    if (emoji) {
      localStorage.setItem(LS_KEY, String(streak))
      applyEmojiFavicon(emoji)
    } else {
      localStorage.removeItem(LS_KEY)
      resetFavicon()
    }
  }, [streak])
}
