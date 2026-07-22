import React, { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

function PullToRefresh({ onRefresh, children }) {
  const [startY, setStartY] = useState(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const MAX_PULL = 100
  const THRESHOLD = 60

  useEffect(() => {
    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        setStartY(e.touches[0].clientY)
      }
    }

    const handleTouchMove = (e) => {
      if (startY === 0) return
      
      const currentY = e.touches[0].clientY
      const diff = currentY - startY

      if (diff > 0) {
        // Prevent default scrolling when pulling down
        if (e.cancelable) e.preventDefault()
        setPullDistance(Math.min(diff, MAX_PULL))
      }
    }

    const handleTouchEnd = async () => {
      if (pullDistance > THRESHOLD && !isRefreshing) {
        setIsRefreshing(true)
        if (onRefresh) {
          await onRefresh()
        }
        setIsRefreshing(false)
      }
      setStartY(0)
      setPullDistance(0)
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [startY, pullDistance, isRefreshing, onRefresh])

  return (
    <div className="relative w-full h-full">
      {/* Pull indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center items-center overflow-hidden transition-all duration-200"
        style={{ 
          height: `${isRefreshing ? THRESHOLD : pullDistance}px`,
          opacity: Math.min(pullDistance / THRESHOLD, 1)
        }}
      >
        <RefreshCw 
          className={`text-blue-500 ${isRefreshing ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${pullDistance * 2}deg)` }}
        />
      </div>
      
      {/* Content wrapper */}
      <div 
        className="transition-transform duration-200"
        style={{ transform: `translateY(${isRefreshing ? THRESHOLD : pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  )
}

export default PullToRefresh
