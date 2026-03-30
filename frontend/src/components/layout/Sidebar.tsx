import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, HardHat, Wrench,
  FileText, BarChart3,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Home', to: '/', icon: LayoutDashboard, exact: true },
  { type: 'divider', label: 'Cadastros' },
  { label: 'Usuarios', to: '/usuarios', icon: Users },
  { label: 'Clientes', to: '/clientes', icon: Building2 },
  { label: 'Obras', to: '/obras', icon: HardHat },
  { label: 'Equipamentos', to: '/equipamentos', icon: Wrench },
  { type: 'divider', label: 'Operacional' },
  { label: 'Producao', to: '/producao', icon: BarChart3 },
  { label: 'Diarios de Obra', to: '/diarios', icon: FileText },
]

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

export default function Sidebar({ open, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex min-h-screen shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-slate-100 transition-all duration-300',
        open ? 'w-56' : 'w-[74px]'
      )}
    >
      <div className="flex h-[70px] items-center border-b border-white/8 px-4">
        {open ? (
          <div className="leading-none">
            <div className="app-title text-[28px] tracking-[0.16em] text-white">GONTIJO</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
              Fundacoes
            </div>
          </div>
        ) : (
          <div className="app-title mx-auto text-2xl tracking-[0.2em] text-white">G</div>
        )}

        {open && (
          <button
            onClick={onToggle}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft size={17} />
          </button>
        )}
      </div>

      {!open && (
        <div className="flex justify-center border-b border-white/8 py-2">
          <button
            onClick={onToggle}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-1.5 py-3">
        {navItems.map((item, index) => {
          if (item.type === 'divider') {
            return open ? (
              <div
                key={`${item.label}-${index}`}
                className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400"
              >
                {item.label}
              </div>
            ) : (
              <div key={`${item.label}-${index}`} className="mx-auto my-3 h-px w-8 bg-white/10" />
            )
          }

          const Icon = item.icon!

          return (
            <NavLink
              key={item.to}
              to={item.to!}
              end={item.exact}
              className={({ isActive }) =>
                cn(
                  'mb-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--brand-red)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                    : 'text-slate-200 hover:bg-white/8 hover:text-white',
                  !open && 'justify-center px-0'
                )
              }
            >
              <Icon size={16} className="shrink-0" />
              {open && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
