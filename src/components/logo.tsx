/**
 * Sumtise Logo Component
 * Brand colors: #50B0E0 (primary blue), #1A1D24 (dark background)
 */

import Image from "next/image"

interface LogoProps {
  className?: string
  size?: number
  /** Show just the icon (false) or the full wordmark image (true) */
  showText?: boolean
  /** "default" = icon + text on light bg, "light" = white on transparent, "dark" = color on dark bg */
  variant?: "default" | "dark" | "light"
  /** Use the full combined logo image (icon + SUMTISE wordmark) instead of separate icon + text */
  fullImage?: boolean
}

export function Logo({
  className = "",
  size = 32,
  showText = true,
  variant = "default",
  fullImage = false,
}: LogoProps) {
  // Full combined image (icon + SUMTISE wordmark baked in)
  if (fullImage) {
    const src =
      variant === "light"   ? "/logo-full-white.png"   :
      variant === "dark"    ? "/logo-full-dark-bg.png"  :
                              "/logo-full.png"
    // Full logo is roughly 3:1 wide
    return (
      <Image
        src={src}
        alt="Sumtise"
        width={size * 3}
        height={size}
        className={`flex-shrink-0 object-contain ${className}`}
        unoptimized
        priority
      />
    )
  }

  // Icon-only image
  const iconSrc =
    variant === "light" ? "/logo-white.png" :
    variant === "dark"  ? "/logo-dark-bg.png" :
                          "/logo.png"

  const textColor =
    variant === "light" ? "#FFFFFF" :
    variant === "dark"  ? "#FFFFFF" :
                          "#50B0E0"

  return (
    <div className={`flex items-center space-x-2.5 ${className}`}>
      <Image
        src={iconSrc}
        alt="Sumtise"
        width={size}
        height={size}
        className="flex-shrink-0 object-contain"
        unoptimized
        priority
      />
      {showText && (
        <span
          className="font-bold tracking-widest uppercase"
          style={{
            color: textColor,
            fontSize: size * 0.6,
            letterSpacing: "0.18em",
          }}
        >
          SUMTISE
        </span>
      )}
    </div>
  )
}
