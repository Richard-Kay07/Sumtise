"use client"

import { useMemo, useState, useEffect, useRef } from 'react'

interface LazyTableProps<T> {
  data: T[]
  renderRow: (item: T, index: number) => React.ReactNode
  renderHeader: () => React.ReactNode
  pageSize?: number
  className?: string
}

/**
 * Lazy-loaded table component for large datasets
 * Only renders visible rows + buffer for smooth scrolling
 */
export function LazyTable<T>({
  data,
  renderRow,
  renderHeader,
  pageSize = 50,
  className = "",
}: LazyTableProps<T>) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: pageSize })
  const [isScrolling, setIsScrolling] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()

  // Calculate visible items
  const visibleData = useMemo(() => {
    return data.slice(visibleRange.start, visibleRange.end)
  }, [data, visibleRange])

  // Handle scroll with debouncing
  useEffect(() => {
    const handleScroll = () => {
      if (!tableRef.current) return

      setIsScrolling(true)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
      }, 150)

      const scrollTop = tableRef.current.scrollTop
      const itemHeight = 60 // Approximate row height
      const buffer = 5 // Number of items to render above/below viewport

      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer)
      const end = Math.min(
        data.length,
        start + Math.ceil(tableRef.current.clientHeight / itemHeight) + buffer * 2
      )

      setVisibleRange({ start, end })
    }

    const table = tableRef.current
    if (table) {
      table.addEventListener('scroll', handleScroll, { passive: true })
      handleScroll() // Initial calculation
    }

    return () => {
      if (table) {
        table.removeEventListener('scroll', handleScroll)
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [data.length])

  // Total height for virtual scrolling
  const totalHeight = data.length * 60 // itemHeight

  return (
    <div
      ref={tableRef}
      className={`overflow-auto ${className}`}
      style={{ maxHeight: '600px' }}
    >
      <table className="w-full">
        <thead className="sticky top-0 bg-background z-10">
          {renderHeader()}
        </thead>
        <tbody style={{ height: totalHeight, position: 'relative' }}>
          {visibleData.map((item, index) => (
            <tr
              key={visibleRange.start + index}
              style={{
                position: 'absolute',
                top: (visibleRange.start + index) * 60,
                width: '100%',
                height: 60,
              }}
            >
              {renderRow(item, visibleRange.start + index)}
            </tr>
          ))}
        </tbody>
      </table>
      {isScrolling && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-background/50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  )
}

