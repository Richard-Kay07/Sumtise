/**
 * Sumtise Logo Component
 * Brand colors: #50B0E0 (primary blue), #1A1D24 (dark background)
 * Uses uploaded logo image
 */

import Image from "next/image"

interface LogoProps {
  className?: string
  size?: number
  showText?: boolean
  variant?: "default" | "dark" | "light"
}

export function Logo({ 
  className = "", 
  size = 32, 
  showText = true,
  variant = "default"
}: LogoProps) {
  const textColor = variant === "light" ? "#FFFFFF" : variant === "dark" ? "#1A1D24" : "#50B0E0"

  return (
    <div className={`flex items-center space-x-2.5 ${className}`}>
      {/* Sumtise Logo Image */}
      <Image
        src="/logo.png"
        alt="Sumtise Logo"
        width={size}
        height={size}
        className="flex-shrink-0"
        style={{ 
          objectFit: "contain",
        }}
        unoptimized
      />
      
      {/* Text */}
      {showText && (
        <span 
          className="text-xl font-bold tracking-tight"
          style={{ 
            color: textColor,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            letterSpacing: '0.02em'
          }}
        >
          SUMTISE
        </span>
      )}
    </div>
  )
}
