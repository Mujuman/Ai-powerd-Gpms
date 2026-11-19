import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default function ProjectSubmissionPage() {
  const queryClient = useQueryClient()
  const [forms, setForms] = useState({})
  const projectsQuery = useQuery({
    queryKey: ['student-projects'],
    queryFn: async () => (await api.get('/projects/mine')).data.data,
  })
  const defensesQuery = useQuery({
    queryKey: ['student-defenses'],
    queryFn: async () => (await api.get('/projects/mine/defenses')).data.data,
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
              </div>
              <span className={status === 'approved' ? 'status-active' : status === 'rejected' ? 'status-inactive' : 'dept-chip'}>
                {status ?? 'Not submitted'}
              </span>
            </div>
            {project.title && <div>
              <h3 className="section-title">{project.title}</h3>
              <p className="muted-copy">{project.description}</p>
              {project.reviewNote && <p className="project-review-note"><strong>Department review:</strong> {project.reviewNote}</p>}
              <p className="muted-copy">Advisor: {project.advisorName ?? 'Not assigned yet'}</p>
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
                <button className="btn-primary" disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? 'Submitting…' : status === 'rejected' ? 'Resubmit proposal' : 'Submit proposal'}
                </button>
              </form>
            )}
            {status === 'submitted' && <p className="muted-copy">Your proposal is awaiting Department Head review.</p>}
            {status === 'approved' && <p className="muted-copy">Your title is approved. Contact your assigned advisor for next steps.</p>}
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
            <thead><tr><th>Group</th><th>Defense</th><th>Date and time</th><th>Venue</th><th>Status</th></tr></thead>
            <tbody>{(defensesQuery.data ?? []).map((schedule) => (
              <tr key={schedule.id}>
                <td>{schedule.groupName}</td><td>{schedule.defenseType}</td>
                <td>{new Date(schedule.scheduledAt).toLocaleString()}</td><td>{schedule.venue}</td><td>{schedule.status}</td>
              </tr>
            ))}
              {defensesQuery.data?.length === 0 && <tr><td className="table-empty" colSpan={5}>No defenses are scheduled for your groups.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
