import { RouterProvider } from 'react-router-dom'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastViewport } from './components/ui/ToastViewport'
import { publishToast } from './lib/toastBus'
import { router } from './router'

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      if (mutation.meta?.toast === false) return
      publishToast({
        type: 'success',
        message: mutation.meta?.successToastMessage ?? 'Operation successful.',
      })
    },
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.toast === false) return
      const response = error?.response?.data
      const details = Array.isArray(response?.errors)
        ? response.errors.map((detail) => (
          `${detail.path ? `${detail.path}: ` : ''}${detail.message}`
        ))
        : []
      publishToast({
        type: 'error',
        message: response?.message ?? mutation.meta?.errorToastMessage ?? 'The operation failed.',
        details,
      })
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastViewport />
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
