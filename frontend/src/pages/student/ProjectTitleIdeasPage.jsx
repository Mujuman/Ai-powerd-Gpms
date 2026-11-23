import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default function ProjectTitleIdeasPage() {
  const navigate = useNavigate()
  const [groupId, setGroupId] = useState('')
  const [preferences, setPreferences] = useState({ interest: '', area: '', tools: '' })
  const [recommendations, setRecommendations] = useState(null)
  const projectsQuery = useQuery({
    queryKey: ['student-projects'],
    queryFn: async () => (await api.get('/projects/mine')).data.data,
  })
  const projects = projectsQuery.data ?? []
  const selectedProject = projects.find((project) => project.groupId === groupId) ?? projects[0]
  const recommendationMutation = useMutation({
    mutationFn: async () => (await api.post(
      `/projects/mine/${selectedProject.groupId}/title-recommendations`,
      preferences,
    )).data.data,
    onSuccess: setRecommendations,
  })

  useEffect(() => {
    if (!groupId && projects.length) setGroupId(projects[0].groupId)
  }, [groupId, projects])

  function updatePreference(field, value) {
    setPreferences((current) => ({ ...current, [field]: value }))
  }

  function useTitle(title) {
    navigate('/student/project/proposal', {
      state: { groupId: selectedProject.groupId, title },
    })
  }

  const canRecommend = Object.values(preferences).every((value) => value.trim().length >= 2)

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Project title ideas</h1>
          <p className="page-subtitle">Get project-only title suggestions based on your interests, application area, and tools.</p>
        </div>
        <Link className="btn-secondary" to="/student/project/proposal">Go to proposal</Link>
      </div>
      {projectsQuery.isError && <div className="table-error" role="alert">
        {message(projectsQuery.error, 'Could not load your project groups')}
      </div>}
      {recommendationMutation.error && <div className="table-error" role="alert">
        {message(recommendationMutation.error, 'Could not create title suggestions')}
      </div>}
      {projectsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading project groups…</div>}
      {selectedProject && (
        <section className="academic-card">
          <h2 className="section-title">{selectedProject.groupName}</h2>
          {projects.length > 1 && (
            <label className="form-field">
              <span className="form-label">Project group</span>
              <select className="form-input" value={selectedProject.groupId}
                onChange={(event) => {
                  setGroupId(event.target.value)
                  setRecommendations(null)
                }}>
                {projects.map((project) => (
                  <option key={project.groupId} value={project.groupId}>{project.groupName}</option>
                ))}
              </select>
            </label>
          )}
          <form className="rules-form" onSubmit={(event) => {
            event.preventDefault()
            recommendationMutation.mutate()
          }}>
            {[
              ['interest', "Student's interests"],
              ['area', 'Project application area'],
              ['tools', 'Tools or technologies'],
            ].map(([field, label]) => (
              <label className="form-field" key={field}>
                <span className="form-label">{label}</span>
                <input className="form-input" required minLength={2} maxLength={2000}
                  value={preferences[field]}
                  onChange={(event) => updatePreference(field, event.target.value)} />
              </label>
            ))}
            <button className="btn-primary" disabled={!canRecommend || recommendationMutation.isPending}>
              {recommendationMutation.isPending ? 'Creating ideas…' : 'Recommend project titles'}
            </button>
          </form>
          {recommendations && (
            <div className="import-preview" aria-live="polite">
              <p className="muted-copy">{recommendations.notice}</p>
              <p className="muted-copy">
                Draft method: {recommendations.generationMethod}
                {recommendations.similarityModel
                  ? ` · originality check: ${recommendations.similarityModel}`
                  : ''}
              </p>
              {recommendations.suggestions.map((idea) => (
                <div className="action-row" key={idea.title}>
                  <div>
                    <strong>{idea.title}</strong>
                    <p className="muted-copy">Idea relevance: {Math.round(idea.relevanceScore * 100)}%</p>
                    {idea.closestApprovedTitleSimilarity !== null && (
                      <p className="muted-copy">
                        Closest approved-title similarity: {Math.round(idea.closestApprovedTitleSimilarity * 100)}%
                      </p>
                    )}
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => useTitle(idea.title)}>
                    Use for proposal
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {!projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0 && (
        <section className="academic-card">
          <p className="muted-copy">You need an active project group before requesting title ideas.</p>
        </section>
      )}
    </div>
  )
}
