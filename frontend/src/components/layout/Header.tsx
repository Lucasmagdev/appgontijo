import { Menu, LogOut, User } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <header className="flex h-11 items-center gap-4 bg-[var(--topbar-bg)] px-4 text-white shadow-sm">
      <button
        onClick={onMenuClick}
        className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-white/90 transition hover:bg-white/12"
      >
        <Menu size={16} />
      </button>

      <div className="flex-1" />

      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 transition hover:bg-white/16"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[var(--topbar-bg)]">
            <User size={14} />
          </div>
          <span className="text-[12px] font-medium tracking-wide text-white">
            {user?.name ?? 'Usuario'}
          </span>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-md border border-slate-200 bg-white py-1 text-slate-700 shadow-lg">
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={15} />
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
