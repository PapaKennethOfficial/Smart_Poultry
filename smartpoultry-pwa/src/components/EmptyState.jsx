import React from 'react'
import { Inbox } from 'lucide-react'

function EmptyState({ 
  icon: Icon = Inbox, 
  title = "No data found", 
  description = "There is nothing to display here right now.",
  actionText,
  onAction
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100 my-4">
      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
        <Icon size={32} className="text-blue-500" />
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">
        {description}
      </p>
      {actionText && onAction && (
        <button 
          onClick={onAction}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  )
}

export default EmptyState
