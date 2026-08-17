import { useEffect } from "react";
import { X } from "lucide-react";

export default function SlideOverPanel({ isOpen, onClose, title, children }) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md transform transition-transform ease-in-out duration-300">
          <div className="h-full flex flex-col bg-white shadow-xl">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
              <h2 className="text-lg font-bold text-ink">{title}</h2>
              <button 
                onClick={onClose}
                className="p-2 -mr-2 text-muted hover:bg-surface rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto bg-surface/30">
              {children}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
