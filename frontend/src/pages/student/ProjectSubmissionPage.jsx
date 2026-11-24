import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

function similarityPercent(score) {
  return `${(Math.floor(score * 10000) / 100).toFixed(2)}%`
}

export default function ProjectSubmissionPage() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [forms, setForms] = useState({})
  const [editingGroups, setEditingGroups] = useState({})
  const [submissionResults, setSubmissionResults] = useState({})
  const autoReviewQuery = useQuery({
    queryKey: ['student-project-auto-review'],
    queryFn: async () => (await api.post('/projects/mine/auto-review')).data.data,
  })
  const projectsQuery = useQuery({
    queryKey: ['student-projects'],
    enabled: autoReviewQuery.isSuccess || autoReviewQuery.isError,
    queryFn: async () => (await api.get('/projects/mine')).data.data,
  })
  const submitMutation = useMutation({
    mutationFn: async ({ groupId, title, description }) =>
      (await api.post('/projects/mine', { groupId, title, description })).data.data,
    onSuccess: (data, variables) => {
      setSubmissionResults((current) => ({
        ...current,
        [variables.groupId]: {
          ...data.similarityCheck,
          advisorAssignment: data.advisorAssignment,
        },
      }))
      void queryClient.invalidateQueries({ queryKey: ['student-projects'] })
    },
  })
  const updateMutation = useMutation({
    mutationFn: async ({ groupId, title, description }) =>
      (await api.patch(`/projects/mine/${groupId}`, { title, description })).data.data,
    onSuccess: (data, variables) => {
      setEditingGroups((current) => ({ ...current, [variables.groupId]: false }))
      setSubmissionResults((current) => ({
        ...current,
        [variables.groupId]: {
          ...data.similarityCheck,
          advisorAssignment: data.advisorAssignment,
        },
      }))
      void queryClient.invalidateQueries({ queryKey: ['student-projects'] })
    },
  })
  const withdrawMutation = useMutation({
    mutationFn: async (groupId) => (await api.delete(`/projects/mine/${groupId}`)).data.data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-projects'] })
      void queryClient.invalidateQueries({ queryKey: ['student-project-auto-review'] })
    },
  })
  const projects = projectsQuery.data ?? []
  const isLoading = autoReviewQuery.isLoading || projectsQuery.isLoading

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
    const values = { groupId, title: form.title ?? '', description: form.description ?? '' }
    if (editingGroups[groupId]) updateMutation.mutate(values)
    else submitMutation.mutate(values)
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
      {projectsQuery.isError && <div className="table-error" role="alert">
        {message(projectsQuery.error, 'Could not load your project groups')}
      </div>}
      {autoReviewQuery.isError && <div className="table-error" role="alert">
        {message(autoReviewQuery.error, 'Could not complete the automatic proposal review')}
      </div>}
      {submitMutation.error && <div className="table-error" role="alert">{message(submitMutation.error, 'Could not submit the project')}</div>}
      {updateMutation.error && <div className="table-error" role="alert">{message(updateMutation.error, 'Could not update the approved proposal')}</div>}
      {withdrawMutation.error && <div className="table-error" role="alert">{message(withdrawMutation.error, 'Could not withdraw the approved proposal')}</div>}
      {isLoading && <div className="table-loading" aria-busy="true">Loading project groups…</div>}
      {projects.map((project) => {
        const status = project.submissionStatus
        const canSubmit = !status || status === 'rejected' || status === 'withdrawn'
        const isEditing = Boolean(editingGroups[project.groupId])
        const values = forms[project.groupId] ?? {}
        const similarityCheck = submissionResults[project.groupId]
        const advisorAssignment = similarityCheck?.advisorAssignment
          ?? autoReviewQuery.data?.advisorAssignments?.find(
            (assignment) => assignment.groupId === project.groupId,
          )
        return (
          <section className="academic-card" key={project.groupId}>
            <div className="page-header">
              <div>
                <h2 className="section-title">{project.groupName}</h2>
                <p className="page-subtitle">{project.departmentCode} · {project.departmentName}</p>
                <p className="muted-copy">Advisor: {project.advisorName ?? 'Not assigned yet'}</p>
              </div>
              <span className={status === 'approved' ? 'status-active'
                : status === 'rejected' || status === 'withdrawn' ? 'status-inactive' : 'dept-chip'}>
                {status ?? 'Not submitted'}
              </span>
            </div>
            {advisorAssignment?.status === 'assigned' && (
              <p className="muted-copy">AI automatically assigned advisor: {advisorAssignment.advisorName}</p>
            )}
            {advisorAssignment?.status === 'unassigned' && (
              <p className="table-error" role="alert">{advisorAssignment.reason}</p>
            )}
            {project.title && <div>
              <h3 className="section-title">{project.title}</h3>
              <p className="muted-copy">{project.description}</p>
              {project.reviewNote && <p className="project-review-note">
                <strong>{project.reviewNote.startsWith('Automatically approved:')
                  ? 'Automatic approval'
                  : project.reviewNote.startsWith('Automatically rejected:')
                    ? 'Automatic rejection'
                  : project.reviewNote.startsWith('Automatic similarity check:')
                    ? 'Similarity check'
                    : project.reviewNote === 'Withdrawn by group leader'
                      ? 'Withdrawn'
                    : 'Department review'}:</strong> {project.reviewNote}
              </p>}
            </div>}
            {status === 'approved' && project.isGroupLeader && !isEditing && (
              <div className="action-row">
                <button className="btn-secondary" onClick={() => {
                  setForms((current) => ({
                    ...current,
                    [project.groupId]: {
                      title: project.title ?? '',
                      description: project.description ?? '',
                    },
                  }))
                  setEditingGroups((current) => ({ ...current, [project.groupId]: true }))
                }}>
                  Edit approved proposal
                </button>
                <button className="btn-danger" disabled={withdrawMutation.isPending}
                  onClick={() => {
                    if (window.confirm('Withdraw this approved proposal? Its history will be kept, but its advisor assignment will end.')) {
                      withdrawMutation.mutate(project.groupId)
                    }
                  }}>
                  Withdraw proposal
                </button>
              </div>
            )}
            {status === 'approved' && !project.isGroupLeader && (
              <p className="muted-copy">Only the group leader can edit or withdraw the approved proposal.</p>
            )}
            {similarityCheck && (
              <div className="import-preview" role="status" aria-live="polite">
                <strong>AI similarity check</strong>
                <p className="muted-copy">{similarityCheck.notice}</p>
                {similarityCheck.autoApproval && (
                  <p className="muted-copy">
                    {similarityCheck.autoApproval.automaticallyApproved
                      ? 'Automatically approved'
                      : similarityCheck.autoApproval.automaticallyRejected
                        ? 'Automatically rejected'
                        : 'Similarity decision pending'}
                    {similarityCheck.comparisons.length
                      ? ` · highest similarity ${similarityPercent(similarityCheck.autoApproval.highestSimilarity)}`
                      : ' · no approved projects were available to compare'}
                    {` · similarity threshold ${similarityCheck.autoApproval.thresholdPercent}%`}
                  </p>
                )}
                {similarityCheck.autoApproval?.automaticallyApproved && (
                  !advisorAssignment && <p className="muted-copy">AI is selecting an advisor for your approved project.</p>
                )}
                {similarityCheck.comparisons.length > 0 ? (
                  <ul>{similarityCheck.comparisons.slice(0, 5).map((comparison) => (
                    <li key={comparison.title}>
                      {comparison.title} · {similarityPercent(comparison.score)} similarity
                    </li>
                  ))}</ul>
                ) : <p className="muted-copy">Nothing to compare yet.</p>}
              </div>
            )}
            {(canSubmit || isEditing) && (
              <form className="rules-form" onSubmit={(event) => submit(event, project.groupId)}>
                <label className="form-field"><span className="form-label">Project title</span>
                  <input className="form-input" required minLength={8} maxLength={240} value={values.title ?? ''}
                    onChange={(event) => updateForm(project.groupId, 'title', event.target.value)} />
                </label>
                <label className="form-field project-description-field"><span className="form-label">Project description</span>
                  <textarea className="form-input" required minLength={30} maxLength={10000} rows={5}
                    value={values.description ?? ''}
                    onChange={(event) => updateForm(project.groupId, 'description', event.target.value)} />
                </label>
                <div className="action-row">
                  <button className="btn-primary" disabled={submitMutation.isPending || updateMutation.isPending}>
                    {updateMutation.isPending
                      ? 'Updating…'
                      : isEditing ? 'Save and review changes'
                        : submitMutation.isPending ? 'Submitting…'
                          : status === 'rejected' ? 'Resubmit proposal'
                            : status === 'withdrawn' ? 'Submit new proposal' : 'Submit proposal'}
                  </button>
                  {isEditing && (
                    <button type="button" className="btn-secondary"
                      onClick={() => setEditingGroups((current) => ({ ...current, [project.groupId]: false }))}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
            {status === 'submitted' && <p className="muted-copy">
              {project.reviewNote?.startsWith('Automatic similarity check:')
                ? project.reviewNote
                : 'Your proposal is awaiting Department Head review.'}
            </p>}
            {status === 'approved' && <p className="muted-copy">
              {project.reviewNote?.startsWith('Automatically approved:')
                ? 'Your proposal was automatically approved because it is not sufficiently similar to approved projects.'
                : 'Your title is approved.'}
              {' '}Contact your assigned advisor for next steps.
            </p>}
            {status === 'withdrawn' && <p className="muted-copy">
              This proposal was withdrawn. Its history remains available, and the group leader can submit another proposal.
            </p>}
          </section>
        )
      })}
      {!isLoading && projects.length === 0 && (
        <section className="academic-card"><p className="muted-copy">You are not currently assigned to an active project group. Contact your Department Head.</p></section>
      )}

    </div>
  )
}
