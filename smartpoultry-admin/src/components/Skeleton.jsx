import React from 'react'

function Skeleton({ className = "", variant = "rectangular", ...props }) {
  // variants: "text", "circular", "rectangular", "rounded"
  let baseClass = "bg-gray-200 animate-pulse"
  
  if (variant === "text") baseClass += " rounded-md h-4 w-full"
  if (variant === "circular") baseClass += " rounded-full h-12 w-12"
  if (variant === "rectangular") baseClass += " h-full w-full"
  if (variant === "rounded") baseClass += " rounded-xl h-full w-full"

  return (
    <div className={`${baseClass} ${className}`} {...props} />
  )
}

export default Skeleton
