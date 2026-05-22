import Link from "next/link"
import { ArrowLeft, ChevronRight } from "lucide-react"

interface Crumb {
  label: string
  href: string
}

interface PageHeaderProps {
  crumbs: Crumb[]
  title: string
  icon?: React.ReactNode
  actions?: React.ReactNode
}

const SECTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Reports:      { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200" },
  Settings:     { bg: "bg-slate-50",   text: "text-slate-700",   border: "border-slate-200"  },
  Payroll:      { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200"},
  Tax:          { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"  },
  Banking:      { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200"    },
  Invoices:     { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200"   },
  Customers:    { bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200"   },
  Expenses:     { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200" },
  Transactions: { bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200" },
  Accounting:   { bg: "bg-cyan-50",    text: "text-cyan-700",    border: "border-cyan-200"   },
  Budgets:      { bg: "bg-lime-50",    text: "text-lime-700",    border: "border-lime-200"   },
  Leases:       { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200"   },
  Projects:     { bg: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-200"},
  Grants:       { bg: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-200"   },
}

const DEFAULT_COLOR = { bg: "bg-[#50B0E0]/10", text: "text-[#50B0E0]", border: "border-[#50B0E0]/30" }

export function PageHeader({ crumbs, title, icon, actions }: PageHeaderProps) {
  const backCrumb = crumbs[crumbs.length - 1]
  const sectionLabel = crumbs[0]?.label ?? ""
  const colors = SECTION_COLORS[sectionLabel] ?? DEFAULT_COLOR

  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Location tile */}
      <div className="max-w-screen-xl mx-auto px-4 py-3">
        <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 shadow-sm ${colors.bg} ${colors.border}`}>
          {/* Back arrow */}
          <Link
            href={backCrumb.href}
            className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors hover:bg-white/60 ${colors.text}`}
            aria-label={`Back to ${backCrumb.label}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>

          {/* Breadcrumb path */}
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className={`h-3 w-3 opacity-40 ${colors.text}`} />}
              <Link
                href={c.href}
                className={`text-xs font-semibold uppercase tracking-wide transition-colors hover:underline ${colors.text}`}
              >
                {c.label}
              </Link>
            </span>
          ))}

          <ChevronRight className={`h-3 w-3 opacity-40 ${colors.text}`} />

          {/* Current page — no link */}
          <span className={`text-xs font-bold uppercase tracking-wide ${colors.text}`}>
            {title}
          </span>
        </div>

        {/* Title row */}
        {(icon || actions) && (
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2.5">
              {icon && <span className={colors.text}>{icon}</span>}
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h1>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}
        {!icon && !actions && (
          <h1 className="mt-2 text-xl font-bold text-gray-900 tracking-tight">{title}</h1>
        )}
      </div>
    </div>
  )
}
