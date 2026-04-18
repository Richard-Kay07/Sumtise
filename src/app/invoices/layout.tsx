"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FilePlus, FileText, FileMinus, Mail } from "lucide-react"

interface InvoicesLayoutProps {
  children: React.ReactNode
}

const subNavigation = [
  { name: "View Invoices", href: "/invoices", icon: FileText, exact: true },
  { name: "Create Invoice", href: "/invoices/new", icon: FilePlus },
  { name: "Credit Note", href: "/invoices/credit-note", icon: FileMinus },
  { name: "Send Reminders", href: "/invoices/reminders", icon: Mail },
]

export default function InvoicesLayout({ children }: InvoicesLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-screen">
      {/* Sub-Navigation */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4">
          <nav className="flex items-center space-x-1 overflow-x-auto">
            {subNavigation.map((item) => {
              const isActive = item.exact 
                ? pathname === item.href 
                : pathname.startsWith(item.href)
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center px-4 py-2.5 text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-t-xl",
                    isActive
                      ? "text-primary bg-primary/10 border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}

