import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ProjectCollaborationPanel } from '../../components/projects/ProjectCollaborationPanel'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default function ProjectSubmissionPage() {
  const queryClient = useQueryClient()
  const [forms, setForms] = useState({})
  const [recommendations, setRecommendations] = useState({})
  const projectsQuery = useQuery({
    queryKey: ['student-projects'],
    queryFn: async () => (await api.get('/projects/mine')).data.data,
  })
  const defensesQuery = useQuery({
    queryKey: ['student-defenses'],
    queryFn: async () => (await api.get('/projects/mine/defenses')).data.data,
    refetchInterval: 15000,
  })
  const recommendationMutation = useMutation({
    mutationFn: async ({ groupId, description }) =>
      (await api.post(`/projects/mine/${groupId}/title-recommendations`, { description })).data.data,
    onSuccess: (data, variables) => {
      setRecommendations((current) => ({ ...current, [variables.groupId]: data }))
    },
  })
  const submitMutation = useMutation({
    mutationFn: async ({ groupId, title, description }) =>
      (await api.post('/projects/mine', { groupId, title, description })).data.data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-projects'] })
    },
  })
  const projects = projectsQuery.data ?? []

  function updateForm(groupId, field, value) {
    setForms((current) => ({
      ...current,
      [groupId]: { ...current[groupId], [field]: value },
    }))
  }

  function submit(event, groupId) {
    event.preventDefault()
    const form = forms[groupId] ?? {}
    submitMutation.mutate({ groupId, title: form.title ?? '', description: form.description ?? '' })
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Project proposal</h1>
          <p className="page-subtitle">Submit a title and description for your project group and follow its review status.</p>
        </div>
      </div>
      {projectsQuery.isError && <div className="table-error" role="alert">{message(projectsQuery.error, 'Could not load your project groups')}</div>}
      {submitMutation.error && <div className="table-error" role="alert">{message(submitMutation.error, 'Could not submit the project')}</div>}
      {recommendationMutation.error && <div className="table-error" role="alert">
        {message(recommendationMutation.error, 'Could not create title suggestions')}
      </div>}
      {projectsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading project groups…</div>}
      {projects.map((project) => {
        const status = project.submissionStatus
        const canSubmit = !status || status === 'rejected'
        const values = forms[project.groupId] ?? {}
        return (
          <section className="academic-card" key={project.groupId}>
            <div className="page-header">
              <div>
                <h2 className="section-title">{project.groupName}</h2>
                <p className="page-subtitle">{project.departmentCode} · {project.departmentName} · {project.academicYear}</p>
                <p className="muted-copy">Advisor: {project.advisorName ?? 'Not assigned yet'}</p>
              </div>
              <span className={status === 'approved' ? 'status-active' : status === 'rejected' ? 'status-inactive' : 'dept-chip'}>
                {status ?? 'Not submitted'}
              </span>
            </div>
            {project.title && <div>
              <h3 className="section-title">{project.title}</h3>
              <p className="muted-copy">{project.description}</p>
              {project.reviewNote && <p className="project-review-note"><strong>Department review:</strong> {project.reviewNote}</p>}
            </div>}
            {canSubmit && (
              <form className="rules-form" onSubmit={(event) => submit(event, project.groupId)}>
                <label className="form-field"><span className="form-label">Project title</span>
                  <input className="form-input" required minLength={8} maxLength={240} value={values.title ?? ''}
                    onChange={(event) => updateForm(project.groupId, 'title', event.target.value)} />
                </label>
                <label className="form-field"><span className="form-label">Project description</span>
                  <textarea className="form-input" required minLength={30} maxLength={10000} rows={5}
                    value={values.description ?? ''}
                    onChange={(event) => updateForm(project.groupId, 'description', event.target.value)} />
                </label>
                <div className="action-row">
                  <button type="button" className="btn-secondary"
                    disabled={(values.description ?? '').trim().length < 30 || recommendationMutation.isPending}
                    onClick={() => recommendationMutation.mutate({
                      groupId: project.groupId,
                      description: values.description,
                    })}>
                    {recommendationMutation.isPending
                      && recommendationMutation.variables?.groupId === project.groupId
                      ? 'Creating ideas…'
                      : 'Get title ideas'}
                  </button>
                </div>
                {recommendations[project.groupId] && (
                  <div className="import-preview" aria-live="polite">
                    <p className="muted-copy">{recommendations[project.groupId].notice}</p>
                    <p className="muted-copy">
                      Draft method: {recommendations[project.groupId].generationMethod}
                      {recommendations[project.groupId].similarityModel
                        ? ` · originality check: ${recommendations[project.groupId].similarityModel}`
                        : ''}
                    </p>
                    {recommendations[project.groupId].suggestions.map((idea) => (
                      <div className="action-row" key={idea.title}>
                        <div>
                          <strong>{idea.title}</strong>
                          <p className="muted-copy">
                            Idea relevance: {Math.round(idea.relevanceScore * 100)}%
                          </p>
                          {idea.closestApprovedTitleSimilarity !== null && (
                            <p className="muted-copy">
                              Closest approved-title similarity: {Math.round(idea.closestApprovedTitleSimilarity * 100)}%
                            </p>
                          )}
                        </div>
                        <button type="button" className="btn-secondary"
                          onClick={() => updateForm(project.groupId, 'title', idea.title)}>
                          Use draft
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn-primary" disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? 'Submitting…' : status === 'rejected' ? 'Resubmit proposal' : 'Submit proposal'}
                </button>
              </form>
            )}
            {status === 'submitted' && <p className="muted-copy">Your proposal is awaiting Department Head review.</p>}
            {status === 'approved' && <p className="muted-copy">Your title is approved. Contact your assigned advisor for next steps.</p>}
            <ProjectCollaborationPanel
              groupId={project.groupId}
              role="student"
              advisorAssigned={Boolean(project.advisorName)}
              correctionAllowed={defensesQuery.data?.some((schedule) =>
                schedule.groupId === project.groupId
                && schedule.results?.some((result) => result.outcome === 'revision_required')) === true}
            />
          </section>
        )
      })}
      {!projectsQuery.isLoading && projects.length === 0 && (
        <section className="academic-card"><p className="muted-copy">You are not currently assigned to an active project group. Contact your Department Head.</p></section>
      )}

      <section className="academic-card">
        <h2 className="section-title">Defense schedule</h2>
        {defensesQuery.error && <div className="table-error" role="alert">{message(defensesQuery.error, 'Could not load defense schedules')}</div>}
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Group</th><th>Defense</th><th>Date and time</th><th>Venue</th><th>Status</th><th>Examiners and results</th></tr></thead>
            <tbody>{(defensesQuery.data ?? []).map((schedule) => (
              <tr key={schedule.id}>
                <td>{schedule.groupName}</td><td>{schedule.defenseType}</td>
                <td>{new Date(schedule.scheduledAt).toLocaleString()}</td><td>{schedule.venue}</td><td>{schedule.status}</td>
                <td>
                  {schedule.examiners?.map((examiner) => (
                    <p key={examiner.userId}>{examiner.fullName} · {examiner.assignmentMethod === 'ai' ? 'AI assigned' : 'assigned'}</p>
                  ))}
                  {schedule.results?.map((result) => (
                    <div key={result.id}>
                      <strong>{result.examinerName}: {result.outcome.replaceAll('_', ' ')}</strong>
                      <p>{result.comments}</p>
                      {result.rubric && <pre>{JSON.stringify(result.rubric, null, 2)}</pre>}
                    </div>
                  ))}
                  {!schedule.examiners?.length && !schedule.results?.length && 'No examiner results yet.'}
                </td>
              </tr>
            ))}
              {defensesQuery.data?.length === 0 && <tr><td className="table-empty" colSpan={6}>No defenses are scheduled for your groups.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
