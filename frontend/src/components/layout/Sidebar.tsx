import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Building2, HardHat, Wrench,
  FileText, BarChart3, KeyRound, BookOpen,
  Fingerprint,
  ClipboardCheck,
  MessageCircle,
  Gauge,
  ListChecks,
  Receipt,
  ChevronLeft, ChevronRight, ChevronDown,
  Layers, ClipboardList, CalendarClock,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  clienteService, dashboardService, diarioService,
  equipamentoService, modalidadeService, obraService, operationalIndicatorsService, predefinedOccurrencesAdminService, usuarioService, solidesPointService, whatsappAdminService,
} from '@/lib/gontijo-api'
import { cn } from '@/lib/utils'

type NavLeaf = { type?: undefined; label: string; to: string; icon: React.ElementType; exact?: boolean }
type NavDivider = { type: 'divider'; label: string }
type NavGroup = { type: 'group'; label: string; icon: React.ElementType; children: NavLeaf[] }
type NavItem = NavLeaf | NavDivider | NavGroup

const navItems: NavItem[] = [
  { label: 'Home', to: '/', icon: LayoutDashboard, exact: true },
  { type: 'divider', label: 'Cadastros' },
  { label: 'Usuarios', to: '/usuarios', icon: Users },
  { label: 'Clientes', to: '/clientes', icon: Building2 },
  { label: 'Obras', to: '/obras', icon: HardHat },
  { label: 'Equipamentos', to: '/equipamentos', icon: Wrench },
  { type: 'divider', label: 'Operacional' },
  { label: 'Producao', to: '/producao', icon: BarChart3 },
  { label: 'Indicadores Operacionais', to: '/indicadores-operacionais', icon: Gauge },
  { label: 'Pre-ocorrencias', to: '/pre-ocorrencias', icon: ListChecks },
  { label: 'Verificacao de Ponto', to: '/ponto-verificacao', icon: Fingerprint },
  { label: 'WhatsApp', to: '/whatsapp', icon: MessageCircle },
  { label: 'Avaliacao de Ajudantes', to: '/avaliacao-ajudantes', icon: ClipboardCheck },
  {
    type: 'group',
    label: 'Diarios e Medicoes',
    icon: Layers,
    children: [
      { label: 'Diarios de Obra', to: '/diarios', icon: FileText },
      { label: 'Conferencia de Estacas', to: '/diarios/conferencia', icon: ClipboardList },
      { label: 'Medicoes', to: '/medicoes', icon: Receipt },
      { label: 'Planejamento Diario', to: '/planejamento-diario', icon: CalendarClock },
    ],
  },
  { label: 'Portal do Cliente', to: '/portal-clientes', icon: KeyRound },
  { type: 'divider', label: 'Treinamento' },
  { label: 'Cursos e Provas', to: '/cursos', icon: BookOpen },
]

function loadOpenGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem('sidebar-groups')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const queryClient = useQueryClient()
  const location = useLocation()

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const saved = loadOpenGroups()
    // default: open any group whose child is currently active
    const defaults: Record<string, boolean> = {}
    for (const item of navItems) {
      if (item.type !== 'group') continue
      const active = item.children.some((c) => location.pathname.startsWith(c.to))
      defaults[item.label] = saved[item.label] ?? active ?? true
    }
    return defaults
  })

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: !prev[label] }
      try { localStorage.setItem('sidebar-groups', JSON.stringify(next)) } catch {}
      return next
    })
  }

  function prefetch(to: string) {
    if (to === '/') {
      void queryClient.prefetchQuery({ queryKey: ['dashboard-overview'], queryFn: dashboardService.overview })
    } else if (to === '/usuarios') {
      void queryClient.prefetchQuery({ queryKey: ['usuarios', { search: '', statusFilter: '', page: 1 }], queryFn: () => usuarioService.list({ page: 1, limit: 20 }) })
    } else if (to === '/clientes') {
      void queryClient.prefetchQuery({ queryKey: ['clientes', { search: '', page: 1 }], queryFn: () => clienteService.list({ page: 1, limit: 20 }) })
    } else if (to === '/obras') {
      void queryClient.prefetchQuery({ queryKey: ['obras', { search: '', status: '', clienteId: '', page: 1 }], queryFn: () => obraService.list({ page: 1, limit: 20 }) })
      void queryClient.prefetchQuery({ queryKey: ['cliente-options'], queryFn: clienteService.listOptions })
    } else if (to === '/equipamentos') {
      void queryClient.prefetchQuery({ queryKey: ['equipamentos'], queryFn: equipamentoService.list })
      void queryClient.prefetchQuery({ queryKey: ['modalidades'], queryFn: modalidadeService.list })
    } else if (to === '/diarios') {
      void queryClient.prefetchQuery({ queryKey: ['diarios', { dataInicio: '', dataFim: '', obra: '', modalidadeId: '', equipamentoId: '', page: 1 }], queryFn: () => diarioService.list({ page: 1, limit: 20 }) })
      void queryClient.prefetchQuery({ queryKey: ['modalidades'], queryFn: modalidadeService.list })
      void queryClient.prefetchQuery({ queryKey: ['equipamentos'], queryFn: equipamentoService.list })
    } else if (to === '/ponto-verificacao') {
      void queryClient.prefetchQuery({ queryKey: ['solides-status'], queryFn: solidesPointService.getStatus })
    } else if (to === '/whatsapp') {
      void queryClient.prefetchQuery({ queryKey: ['whatsapp-status'], queryFn: whatsappAdminService.getStatus })
    } else if (to === '/indicadores-operacionais') {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const dateFrom = firstDay.toISOString().slice(0, 10)
      const dateTo = now.toISOString().slice(0, 10)
      void queryClient.prefetchQuery({
        queryKey: ['operational-indicators', { dateFrom, dateTo, operator: '', obra: '' }],
        queryFn: () => operationalIndicatorsService.get({ dateFrom, dateTo }),
      })
    } else if (to === '/pre-ocorrencias') {
      void queryClient.prefetchQuery({ queryKey: ['predefined-occurrences-admin'], queryFn: predefinedOccurrencesAdminService.list })
    }
  }

  function renderLeaf(item: NavLeaf) {
    const Icon = item.icon
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.exact}
        onMouseEnter={() => prefetch(item.to)}
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
        <Icon size={27} className="shrink-0" strokeWidth={2.2} />
        {open && <span className="truncate">{item.label}</span>}
      </NavLink>
    )
  }

  return (
    <aside
      className={cn(
        'flex min-h-screen shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-slate-100 transition-all duration-300',
        open ? 'w-56' : 'w-[74px]'
      )}
    >
      <div className="flex h-[70px] items-center border-b border-white/8 px-4">
        {open ? (
          <div className="flex h-12 w-32 items-center justify-center">
            <img
              src="/gontijo-logo-diarios.png"
              alt="Gontijo Fundações"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="mx-auto flex h-10 w-10 items-center justify-center">
            <img
              src="/gontijo-logo-diarios.png"
              alt="Gontijo"
              className="h-full w-full object-contain"
            />
          </div>
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

          if (item.type === 'group') {
            const GroupIcon = item.icon
            const isExpanded = openGroups[item.label] ?? true
            const hasActiveChild = item.children.some((c) => location.pathname.startsWith(c.to))

            if (!open) {
              // sidebar collapsed: show child icons directly
              return (
                <div key={item.label}>
                  <div className="mx-auto my-1 h-px w-8 bg-white/10" />
                  {item.children.map((child) => renderLeaf(child))}
                  <div className="mx-auto my-1 h-px w-8 bg-white/10" />
                </div>
              )
            }

            return (
              <div key={item.label} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    'mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors',
                    hasActiveChild
                      ? 'text-white'
                      : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  )}
                >
                  <GroupIcon size={27} className="shrink-0" strokeWidth={2.2} />
                  <span className="flex-1 truncate text-left">{item.label}</span>
                  <ChevronDown
                    size={14}
                    className={cn('shrink-0 text-slate-400 transition-transform duration-200', isExpanded && 'rotate-180')}
                  />
                </button>

                {isExpanded && (
                  <div className="ml-3 border-l border-white/10 pl-2">
                    {item.children.map((child) => renderLeaf(child))}
                  </div>
                )}
              </div>
            )
          }

          return renderLeaf(item)
        })}
      </nav>
    </aside>
  )
}
