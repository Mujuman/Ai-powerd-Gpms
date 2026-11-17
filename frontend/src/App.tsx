import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowUpRight, GraduationCap, Server, Sparkles } from 'lucide-react'

type HealthResponse = {
  status: string
}

function App() {
  const apiHealth = useQuery({
    queryKey: ['api-health'],
    queryFn: async () => {
      const { data } = await axios.get<HealthResponse>('/api/health')
      return data
    },
    retry: 1,
    refetchInterval: 30_000,
  })

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="AI-GPMS home">
          <span className="brand-mark"><GraduationCap size={22} /></span>
          <span>AI-GPMS</span>
        </a>
        <span className="phase-label">Project setup</span>
      </header>

      <section className="welcome-card" aria-labelledby="welcome-title">
        <div className="eyebrow"><Sparkles size={15} /> Graduation project management</div>
        <h1 id="welcome-title">A clearer path from proposal to graduation.</h1>
        <p className="intro">
          The application foundation is ready. Role-based academic workflows will be
          introduced in the upcoming development phases.
        </p>
        <div className="status-panel" role="status" aria-live="polite">
          <span className={`status-dot ${apiHealth.isSuccess ? 'online' : ''}`} />
          <Server size={18} />
          <span>Backend API</span>
          <strong>{apiHealth.isSuccess ? 'Connected' : apiHealth.isLoading ? 'Checking' : 'Unavailable'}</strong>
        </div>
        <a className="docs-link" href="https://vite.dev/guide/" target="_blank" rel="noreferrer">
          Development setup <ArrowUpRight size={16} />
        </a>
      </section>
      <footer>Built for university graduation project workflows</footer>
    </main>
  )
}

export default App
