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

const SECTION_COLORS: Record<string, { bg: string; text: string; border: string; hover: string }> = {
  Reports:      { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200/80", hover: "hover:bg-violet-100/60"  },
  Settings:     { bg: "bg-slate-50",   text: "text-slate-600",   border: "border-slate-200/80",  hover: "hover:bg-slate-100/60"   },
  Payroll:      { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200/80",hover: "hover:bg-emerald-100/60" },
  Tax:          { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200/80",  hover: "hover:bg-amber-100/60"   },
  Banking:      { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200/80",    hover: "hover:bg-sky-100/60"     },
  Invoices:     { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200/80",   hover: "hover:bg-blue-100/60"    },
  Customers:    { bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200/80",   hover: "hover:bg-teal-100/60"    },
  Expenses:     { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200/80", hover: "hover:bg-orange-100/60"  },
  Transactions: { bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200/80", hover: "hover:bg-indigo-100/60"  },
  Accounting:   { bg: "bg-cyan-50",    text: "text-cyan-700",    border: "border-cyan-200/80",   hover: "hover:bg-cyan-100/60"    },
  Budgets:      { bg: "bg-lime-50",    text: "text-lime-700",    border: "border-lime-200/80",   hover: "hover:bg-lime-100/60"    },
  Leases:       { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200/80",   hover: "hover:bg-rose-100/60"    },
  Projects:     { bg: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-200/80",hover: "hover:bg-fuchsia-100/60" },
  Grants:       { bg: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-200/80",   hover: "hover:bg-pink-100/60"    },
}

const DEFAULT_COLOR = { bg: "bg-[#50B0E0]/8", text: "text-[#50B0E0]", border: "border-[#50B0E0]/25", hover: "hover:bg-[#50B0E0]/15" }

export function PageHeader({ crumbs, title, actions }: PageHeaderProps) {
  const backCrumb = crumbs[crumbs.length - 1]
  const sectionLabel = crumbs[0]?.label ?? ""
  const colors = SECTION_COLORS[sectionLabel] ?? DEFAULT_COLOR

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">

          {/* Location pill */}
          <div className={`
            inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2
            shadow-sm transition-shadow hover:shadow-md
            ${colors.bg} ${colors.border}
          `}>
            {/* Back arrow button */}
            <Link
              href={backCrumb.href}
              aria-label={`Back to ${backCrumb.label}`}
              className={`
                flex items-center justify-center w-5 h-5 rounded-full
                transition-colors ${colors.hover} ${colors.text}
              `}
            >
              <ArrowLeft className="h-3 w-3 stroke-[2.5]" />
            </Link>

            <span className={`w-px h-3 opacity-30 bg-current ${colors.text}`} />

            {/* Breadcrumb path */}
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1.5">
                {i > 0 && (
                  <ChevronRight className={`h-2.5 w-2.5 opacity-35 ${colors.text}`} />
                )}
                <Link
                  href={c.href}
                  className={`text-[11px] font-semibold uppercase tracking-widest transition-opacity opacity-60 hover:opacity-100 ${colors.text}`}
                >
                  {c.label}
                </Link>
              </span>
            ))}

            <ChevronRight className={`h-2.5 w-2.5 opacity-35 ${colors.text}`} />

            {/* Current page — bold, full opacity, no link */}
            <span className={`text-[11px] font-bold uppercase tracking-widest ${colors.text}`}>
              {title}
            </span>
          </div>

          {/* Right-side actions (optional) */}
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
