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
  const [preferences, setPreferences] = useState({
    projectIdea: '',
    problemStatement: '',
    generalObjective: '',
    specificObjectives: '',
    projectDescription: '',
    technologies: '',
    domain: '',
  })
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

  const canRecommend = [
    'projectIdea',
    'problemStatement',
    'generalObjective',
    'specificObjectives',
    'projectDescription',
    'technologies',
    'domain',
  ]
    .every((field) => preferences[field].trim().length >= 2)

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Project title ideas</h1>
          <p className="page-subtitle">Provide your project details to get clear, scope-appropriate title suggestions.</p>
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
          <form className="rules-form title-ideas-form" onSubmit={(event) => {
            event.preventDefault()
            recommendationMutation.mutate()
          }}>
            {[
              {
                field: 'projectIdea',
                label: 'Project idea',
                description: 'Summarize the main concept of your project.',
                placeholder: 'e.g. An AI-based student attendance system',
                required: true,
                maxLength: 1000,
                rows: 3,
              },
              {
                field: 'problemStatement',
                label: 'Problem statement',
                description: 'Explain the problem and why it needs to be solved.',
                placeholder: 'e.g. Manual attendance takes time and can produce inaccurate records',
                required: true,
                maxLength: 3000,
                rows: 4,
              },
              {
                field: 'generalObjective',
                label: 'General objective',
                description: 'State the overall goal of the project.',
                placeholder: 'e.g. To develop an automated student attendance management system',
                required: true,
                maxLength: 1000,
                rows: 3,
              },
              {
                field: 'specificObjectives',
                label: 'Specific objectives',
                description: 'List the key tasks or functions, one per line.',
                placeholder: 'e.g.\nAutomate attendance recording\nReduce recording errors\nGenerate attendance reports',
                required: true,
                maxLength: 3000,
                rows: 5,
              },
              {
                field: 'projectDescription',
                label: 'Project description',
                description: 'Describe the project scope, how it will work, and its main features.',
                placeholder: 'Explain what users will do with the system and what it will provide.',
                required: true,
                maxLength: 5000,
                rows: 5,
              },
              {
                field: 'technologies',
                label: 'Proposed technologies',
                description: 'List the tools, languages, platforms, or methods you plan to use.',
                placeholder: 'e.g. Python, React, MySQL, and OpenCV',
                required: true,
                maxLength: 1000,
                rows: 3,
              },
              {
                field: 'domain',
                label: 'Project domain',
                description: 'Identify the field the project belongs to.',
                placeholder: 'e.g. Artificial Intelligence and Education',
                required: true,
                maxLength: 1000,
                rows: 3,
              },
            ].map(({ field, label, description, placeholder, required, maxLength, rows }) => (
              <div className="form-field" key={field}>
                <label className="form-label" htmlFor={`title-ideas-${field}`}>{label}</label>
                <span className="muted-copy" id={`title-ideas-${field}-help`}>{description}</span>
                <textarea className="form-input" id={`title-ideas-${field}`}
                  aria-describedby={`title-ideas-${field}-help`}
                  required={required} minLength={2} maxLength={maxLength} rows={rows}
                  value={preferences[field]}
                  placeholder={placeholder}
                  onChange={(event) => updatePreference(field, event.target.value)} />
              </div>
            ))}
            <button className="btn-primary" disabled={!canRecommend || recommendationMutation.isPending}>
              {recommendationMutation.isPending ? 'Generating titles…' : 'Recommend project titles'}
            </button>
            {recommendationMutation.isPending && (
              <p className="muted-copy" role="status" aria-live="polite">
                The local AI model may take longer on its first request while it loads. Later requests reuse the loaded model.
              </p>
            )}
          </form>
          {recommendations && (
            <div className="import-preview" aria-live="polite">
              <p className="muted-copy">{recommendations.notice}</p>
              <p className="muted-copy">
                Generation model: {recommendations.generationMethod}
                {recommendations.similarityModel
                  ? ` · similarity check: ${recommendations.similarityModel}`
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
