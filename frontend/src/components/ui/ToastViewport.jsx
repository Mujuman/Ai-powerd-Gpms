import { useEffect, useState } from 'react'
import { subscribeToToasts } from '../../lib/toastBus'

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), 6000)
    return () => window.clearTimeout(timeout)
  }, [onDismiss, toast.id])

  return (
    <div
      className={`toast-popup toast-popup-${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="toast-popup-header">
        <span>{toast.message}</span>
        <button type="button" className="toast-popup-dismiss" onClick={() => onDismiss(toast.id)}>
          Dismiss
        </button>
      </div>
      {toast.details.length > 0 && (
        <ul className="toast-popup-details">
          {toast.details.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}
        </ul>
      )}
    </div>
  )
}

export function ToastViewport() {
  const [toasts, setToasts] = useState([])

  useEffect(() => subscribeToToasts((toast) => {
    setToasts((current) => [...current, toast].slice(-4))
  }), [])

  function dismissToast(toastId) {
    setToasts((current) => current.filter((toast) => toast.id !== toastId))
  }

  return (
    <div className="toast-viewport" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  )
}
