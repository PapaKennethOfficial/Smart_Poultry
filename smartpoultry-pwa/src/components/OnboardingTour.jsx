import React, { useState, useEffect } from 'react'
import { X, ChevronRight, Check } from 'lucide-react'

// Simple onboarding tour using a modal overlay.
// In a full implementation, this could use a library like react-joyride
// to point at specific elements. For now, it introduces the core concepts.

const TOUR_STEPS = [
  {
    title: "Welcome to SmartPoultry",
    content: "We're excited to have you here! Let's take a quick tour to help you get started with our fresh farm products.",
    image: "🐓"
  },
  {
    title: "Browse the Marketplace",
    content: "Find fresh eggs, poultry meat, live birds, and farm inputs. Use the category tabs to filter items.",
    image: "🛒"
  },
  {
    title: "Track Your Orders",
    content: "Once you place an order, you can track it live on the map from the Orders tab.",
    image: "📍"
  },
  {
    title: 'Your Cart',
    content: 'View your selected items and checkout securely when you are ready.',
    image: '🛍️'
  }
]

export default function OnboardingTour({ onComplete }) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    // Check if user has seen the tour
    const hasSeenTour = localStorage.getItem('smartpoultry_tour_completed')
    if (!hasSeenTour) {
      setIsOpen(true)
    }
  }, [])

  const handleComplete = () => {
    localStorage.setItem('smartpoultry_tour_completed', 'true')
    setIsOpen(false)
    if (onComplete) onComplete()
  }

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  if (!isOpen) return null

  const step = TOUR_STEPS[currentStep]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in relative">
        <button 
          onClick={handleComplete}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1"
        >
          <X size={18} />
        </button>

        <div className="p-8 text-center flex flex-col items-center">
          <div className="text-6xl mb-6 bg-blue-50 w-24 h-24 rounded-full flex items-center justify-center">
            {step.image}
          </div>
          
          <h2 className="text-xl font-bold text-gray-800 mb-3">{step.title}</h2>
          <p className="text-sm text-gray-500 leading-relaxed min-h-[60px]">
            {step.content}
          </p>
        </div>

        <div className="bg-gray-50 p-4 flex items-center justify-between border-t border-gray-100">
          <div className="flex gap-1.5 ml-4">
            {TOUR_STEPS.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-2 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300'}`}
              />
            ))}
          </div>

          <button 
            onClick={handleNext}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
          >
            {currentStep === TOUR_STEPS.length - 1 ? (
              <>Get Started <Check size={16} /></>
            ) : (
              <>Next <ChevronRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
