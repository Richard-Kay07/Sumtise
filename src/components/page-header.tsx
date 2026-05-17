import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface Crumb {
  label: string
  href: string
}

interface PageHeaderProps {
  /** Breadcrumb trail — last item is current page (no link) */
  crumbs: Crumb[]
  /** Current page title */
  title: string
  /** Optional icon rendered before the title */
  icon?: React.ReactNode
  /** Optional right-side actions */
  actions?: React.ReactNode
}

/**
 * Consistent page header with back-navigation breadcrumbs.
 * Matches the dark nav brand chrome.
 *
 * Usage:
 *   <PageHeader
 *     crumbs={[{ label: "Budgets", href: "/budgets" }]}
 *     title="Q1 2025 Budget"
 *     icon={<PiggyBank className="h-4 w-4" />}
 *   />
 */
export function PageHeader({ crumbs, title, icon, actions }: PageHeaderProps) {
  const backCrumb = crumbs[crumbs.length - 1]

  return (
    <div className="border-b bg-white shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4">
        {/* Breadcrumb row */}
        <div className="flex items-center h-10 gap-1.5 text-xs text-gray-400">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-gray-300">/</span>}
              <Link
                href={c.href}
                className="hover:text-[#50B0E0] transition-colors font-medium"
              >
                {c.label}
              </Link>
            </span>
          ))}
          <span className="text-gray-300">/</span>
          <span className="text-gray-600 font-medium truncate max-w-[240px]">{title}</span>
        </div>

        {/* Title + actions row */}
        <div className="flex items-center justify-between h-12 -mt-1">
          <div className="flex items-center gap-3">
            {/* Back button to parent */}
            <Link
              href={backCrumb.href}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#50B0E0] transition-colors group"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 group-hover:border-[#50B0E0]/40 group-hover:bg-[#50B0E0]/5 transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" />
              </span>
            </Link>

            {/* Title */}
            <div className="flex items-center gap-2">
              {icon && (
                <span className="text-[#50B0E0]">{icon}</span>
              )}
              <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
