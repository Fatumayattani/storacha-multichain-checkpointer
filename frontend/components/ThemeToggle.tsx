'use client'

import { useTheme } from './ThemeProvider'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2.5 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 
                 border border-slate-300 dark:border-slate-600 shadow-lg hover:shadow-xl
                 transition-all duration-300 hover:scale-105 active:scale-95
                 group overflow-hidden"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-200/30 to-orange-300/30 dark:from-indigo-400/20 dark:to-purple-500/20" />
      </div>
      
      <div className="relative w-5 h-5">
        <Sun 
          className={`absolute inset-0 w-5 h-5 text-amber-500 transition-all duration-500 ease-out
                     ${theme === 'light' 
                       ? 'rotate-0 scale-100 opacity-100' 
                       : 'rotate-90 scale-0 opacity-0'}`}
        />
        <Moon 
          className={`absolute inset-0 w-5 h-5 text-indigo-400 transition-all duration-500 ease-out
                     ${theme === 'dark' 
                       ? 'rotate-0 scale-100 opacity-100' 
                       : '-rotate-90 scale-0 opacity-0'}`}
        />
      </div>
    </button>
  )
}

