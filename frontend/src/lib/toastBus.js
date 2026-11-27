const listeners = new Set()
let nextToastId = 0

export function publishToast({ type, message, details = [] }) {
  const toast = { id: ++nextToastId, type, message, details }
  for (const listener of listeners) listener(toast)
}

export function subscribeToToasts(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
