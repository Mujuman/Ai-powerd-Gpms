import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default function DefensesPage() {
  const queryClient = useQueryClient()
  const [forms, setForms] = useState({})
  const defensesQuery = useQuery({
    queryKey: ['examiner-defenses'],
    queryFn: async () => (await api.get('/projects/examiner/defenses')).data.data,
  })
  const assessmentMutation = useMutation({
    mutationFn: async ({ scheduleId, outcome, comments }) =>
      api.post(`/projects/examiner/defenses/${scheduleId}/assessment`, { outcome, comments }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['examiner-defenses'] }),
  })
  const defenses = defensesQuery.data ?? []

  function setField(scheduleId, field, value) {
    setForms((current) => ({ ...current, [scheduleId]: { ...current[scheduleId], [field]: value } }))
  }

  function saveAssessment(event, schedule) {
    event.preventDefault()
    const form = forms[schedule.scheduleId] ?? {}
    assessmentMutation.mutate({
      scheduleId: schedule.scheduleId,
      outcome: form.outcome ?? schedule.outcome ?? 'revision_required',
      comments: form.comments ?? schedule.comments ?? '',
    })
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Defenses and assessments</h1>
          <p className="page-subtitle">Review your AI- or Head-assigned defenses and submit or update evaluation records.</p>
        </div>
      </div>
      {defensesQuery.error && <div className="table-error" role="alert">{message(defensesQuery.error, 'Could not load assigned defenses')}</div>}
      {assessmentMutation.error && <div className="table-error" role="alert">{message(assessmentMutation.error, 'Could not submit the assessment')}</div>}
      {defensesQuery.isLoading && <div className="table-loading" aria-busy="true">Loading assigned defenses…</div>}
      {defenses.map((schedule) => {
        const values = forms[schedule.scheduleId] ?? {}
        return (
          <section className="academic-card" key={schedule.scheduleId}>
            <div className="page-header">
              <div>
                <h2 className="section-title">{schedule.groupName}: {schedule.title ?? 'Project title unavailable'}</h2>
                <p className="page-subtitle">{schedule.departmentName} · {schedule.defenseType} · {new Date(schedule.scheduledAt).toLocaleString()} · {schedule.venue}</p>
              </div>
              <span className={schedule.status === 'cancelled' ? 'status-inactive' : 'status-active'}>{schedule.status}</span>
            </div>
            <p className="muted-copy">Assignment method: {schedule.assignmentMethod === 'ai' ? 'AI recommendation' : 'Manual'}</p>
            {schedule.status !== 'cancelled' ? (
              <form className="rules-form" onSubmit={(event) => saveAssessment(event, schedule)}>
                <label className="form-field"><span className="form-label">Evaluation outcome</span>
                  <select className="form-input" value={values.outcome ?? schedule.outcome ?? 'revision_required'}
                    onChange={(event) => setField(schedule.scheduleId, 'outcome', event.target.value)}>
                    <option value="pass">Pass</option>
                    <option value="revision_required">Revision required</option>
                    <option value="fail">Fail</option>
                  </select>
                </label>
                <label className="form-field"><span className="form-label">Evaluation record and feedback</span>
                  <textarea className="form-input" rows={5} required minLength={5} maxLength={10000}
                    value={values.comments ?? schedule.comments ?? ''}
                    onChange={(event) => setField(schedule.scheduleId, 'comments', event.target.value)} />
                </label>
                <button className="btn-primary" disabled={assessmentMutation.isPending}>
                  {assessmentMutation.isPending ? 'Submitting…' : schedule.outcome ? 'Update assessment' : 'Submit assessment'}
                </button>
                {schedule.assessmentSubmittedAt && <p className="muted-copy">Last submitted {new Date(schedule.assessmentSubmittedAt).toLocaleString()}.</p>}
              </form>
            ) : <p className="muted-copy">This defense was cancelled; its assessment can no longer be changed.</p>}
          </section>
        )
      })}
      {!defensesQuery.isLoading && defenses.length === 0 && (
        <section className="academic-card"><p className="muted-copy">No defenses are assigned to you yet.</p></section>
      )}
    </div>
  )
}
