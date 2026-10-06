import { useCallback, useRef, useState } from 'react'

// showToast(message)                          → success, 2.8s
// showToast(message, 'error')                 → error style
// showToast(message, 4000)                    → success, custom duration
// showToast(message, { type, duration })      → both
function normalize(options) {
  if (typeof options === 'number') return { duration: options }
  if (typeof options === 'string') return { type: options }
  return options || {}
}

export default function useToasts() {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const showToast = useCallback((message, options) => {
    const { type = 'success', duration = type === 'error' ? 4000 : 2800 } = normalize(options)
    const id = idRef.current++
    setToasts((current) => [...current, { id, message, type }])
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, duration)
  }, [])

  return { toasts, showToast }
}
