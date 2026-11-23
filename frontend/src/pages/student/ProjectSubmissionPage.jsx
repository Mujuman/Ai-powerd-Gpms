import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default function ProjectSubmissionPage() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [forms, setForms] = useState({})
  const [submissionResults, setSubmissionResults] = useState({})
  const projectsQuery = useQuery({
    queryKey: ['student-projects'],
    queryFn: async () => (await api.get('/projects/mine')).data.data,
  })
  const submitMutation = useMutation({
    mutationFn: async ({ groupId, title, description }) =>
      (await api.post('/projects/mine', { groupId, title, description })).data.data,
    onSuccess: (data, variables) => {
      setSubmissionResults((current) => ({ ...current, [variables.groupId]: data.similarityCheck }))
      void queryClient.invalidateQueries({ queryKey: ['student-projects'] })
    },
  })
  const projects = projectsQuery.data ?? []

  useEffect(() => {
    const { groupId, title } = location.state ?? {}
    if (!groupId || !title) return
    setForms((current) => ({
      ...current,
      [groupId]: { ...current[groupId], title },
    }))
  }, [location.state])

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
          <p className="page-subtitle">Submit a detailed proposal and see its similarity analysis.</p>
        </div>
        <Link className="btn-secondary" to="/student/project/title-ideas">Get title ideas</Link>
      </div>
      {projectsQuery.isError && <div className="table-error" role="alert">{message(projectsQuery.error, 'Could not load your project groups')}</div>}
      {submitMutation.error && <div className="table-error" role="alert">{message(submitMutation.error, 'Could not submit the project')}</div>}
      {projectsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading project groups…</div>}
      {projects.map((project) => {
        const status = project.submissionStatus
        const canSubmit = !status || status === 'rejected'
        const values = forms[project.groupId] ?? {}
        const similarityCheck = submissionResults[project.groupId]
        return (
          <section className="academic-card" key={project.groupId}>
            <div className="page-header">
              <div>
                <h2 className="section-title">{project.groupName}</h2>
                <p className="page-subtitle">{project.departmentCode} · {project.departmentName}</p>
                <p className="muted-copy">Advisor: {project.advisorName ?? 'Not assigned yet'}</p>
              </div>
              <span className={status === 'approved' ? 'status-active' : status === 'rejected' ? 'status-inactive' : 'dept-chip'}>
                {status ?? 'Not submitted'}
              </span>
            </div>
            {project.title && <div>
              <h3 className="section-title">{project.title}</h3>
              <p className="muted-copy">{project.description}</p>
              {project.reviewNote && <p className="project-review-note">
                <strong>{project.reviewNote.startsWith('Automatically approved:')
                  ? 'Automatic approval'
                  : 'Department review'}:</strong> {project.reviewNote}
              </p>}
            </div>}
            {similarityCheck && (
              <div className="import-preview" role="status" aria-live="polite">
                <strong>AI similarity check</strong>
                <p className="muted-copy">{similarityCheck.notice}</p>
                {similarityCheck.modelName && <p className="muted-copy">Analysis: {similarityCheck.modelName}</p>}
                {similarityCheck.autoApproval && (
                  <p className="muted-copy">
                    {similarityCheck.autoApproval.automaticallyApproved
                      ? 'Automatically approved'
                      : 'Sent to the Department Head for review'}
                    {similarityCheck.comparisons.length
                      ? ` · highest similarity ${Math.round(similarityCheck.autoApproval.highestSimilarity * 100)}%`
                      : ' · no approved projects were available to compare'}
                    {` · automatic approval cutoff ${similarityCheck.autoApproval.thresholdPercent}%`}
                  </p>
                )}
                {similarityCheck.comparisons.length > 0 ? (
                  <ul>{similarityCheck.comparisons.slice(0, 5).map((comparison) => (
                    <li key={comparison.title}>
                      {comparison.title} · {Math.round(comparison.score * 100)}% similarity
                    </li>
                  ))}</ul>
                ) : <p className="muted-copy">Nothing to compare yet.</p>}
              </div>
            )}
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
                <button className="btn-primary" disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? 'Submitting…' : status === 'rejected' ? 'Resubmit proposal' : 'Submit proposal'}
                </button>
              </form>
            )}
            {status === 'submitted' && <p className="muted-copy">Your proposal is awaiting Department Head review.</p>}
            {status === 'approved' && <p className="muted-copy">
              {project.reviewNote?.startsWith('Automatically approved:')
                ? 'Your proposal was automatically approved because it is not sufficiently similar to approved projects.'
                : 'Your title is approved.'}
              {' '}Contact your assigned advisor for next steps.
            </p>}
          </section>
        )
      })}
      {!projectsQuery.isLoading && projects.length === 0 && (
        <section className="academic-card"><p className="muted-copy">You are not currently assigned to an active project group. Contact your Department Head.</p></section>
      )}

    </div>
  )
}
