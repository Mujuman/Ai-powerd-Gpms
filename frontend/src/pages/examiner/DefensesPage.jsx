import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ProjectCollaborationPanel } from '../../components/projects/ProjectCollaborationPanel'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

function ExaminerDefenseCard({ schedule, assessmentMutation }) {
  const [form, setForm] = useState({
    outcome: schedule.outcome ?? 'pass',
    comments: schedule.comments ?? '',
    grades: Object.fromEntries((schedule.studentGrades ?? [])
      .map((grade) => [grade.studentUserId, String(grade.grade)])),
  })
  const documentsQuery = useQuery({
    queryKey: ['project-documents', schedule.groupId],
    queryFn: async () => (await api.get(`/projects/groups/${schedule.groupId}/documents`)).data.data,
  })
  const correctionApproved = (documentsQuery.data ?? []).some((document) =>
    document.documentType === 'defense_correction' && document.reviewStatus === 'approved')
  const correctionPendingApproval = schedule.outcome === 'revision_required' && !correctionApproved
  const finalGrade = form.outcome !== 'revision_required'

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function saveAssessment(event) {
    event.preventDefault()
    const studentGrades = finalGrade
      ? schedule.members.map((member) => ({
        studentUserId: member.userId,
        grade: Number(form.grades[member.userId]),
      }))
      : undefined
    assessmentMutation.mutate({
      scheduleId: schedule.scheduleId,
      outcome: form.outcome,
      comments: form.comments,
      studentGrades,
    })
  }

  return (
    <section className="academic-card">
      <div className="page-header">
        <div>
          <h2 className="section-title">{schedule.groupName}: {schedule.title ?? 'Project title unavailable'}</h2>
          <p className="page-subtitle">
            {schedule.departmentName} · {schedule.defenseType} · {new Date(schedule.scheduledAt).toLocaleString()} · {schedule.venue}
          </p>
        </div>
        <span className={schedule.status === 'cancelled' ? 'status-inactive' : 'status-active'}>{schedule.status}</span>
      </div>
      <p className="muted-copy">
        Assignment method: {schedule.assignmentMethod === 'ai' ? 'AI recommendation' : 'Manual'}
        {schedule.isChairperson ? ' · You are the defense chairperson' : ''}
      </p>
      {schedule.status !== 'cancelled' ? (
        <>
          {schedule.outcome === 'revision_required' && (
            <p className={correctionApproved ? 'status-active' : 'muted-copy'}>
              {correctionApproved
                ? 'A defense correction has been approved. Enter a separate grade for each student.'
                : 'Review and approve a student defense correction before submitting final grades.'}
            </p>
          )}
          {documentsQuery.error && <div className="table-error" role="alert">
            {message(documentsQuery.error, 'Could not load defense correction status')}
          </div>}
          <form className="rules-form" onSubmit={saveAssessment}>
            <label className="form-field"><span className="form-label">Evaluation outcome</span>
              <select className="form-input" value={form.outcome}
                onChange={(event) => setField('outcome', event.target.value)}>
                {correctionPendingApproval
                  ? <option value="revision_required">Revision required</option>
                  : <>
                    <option value="pass">Pass</option>
                    <option value="revision_required">Revision required</option>
                    <option value="fail">Fail</option>
                  </>}
              </select>
            </label>
            {finalGrade && (
              <div className="form-grid">
                {schedule.members.map((member) => (
                  <label className="form-field" key={member.userId}>
                    <span className="form-label">
                      Grade for {member.fullName}{member.studentId ? ` (${member.studentId})` : ''} / 100
                    </span>
                    <input className="form-input" type="number" min={0} max={100} step={0.01} required
                      value={form.grades[member.userId] ?? ''}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        grades: { ...current.grades, [member.userId]: event.target.value },
                      }))} />
                  </label>
                ))}
              </div>
            )}
            <label className="form-field"><span className="form-label">Evaluation and feedback</span>
              <textarea className="form-input" rows={5} required minLength={5} maxLength={10000}
                value={form.comments}
                onChange={(event) => setField('comments', event.target.value)} />
            </label>
            <button className="btn-primary"
              disabled={assessmentMutation.isPending || documentsQuery.isLoading
                || correctionPendingApproval || (finalGrade && schedule.members.length === 0)}>
              {assessmentMutation.isPending && assessmentMutation.variables?.scheduleId === schedule.scheduleId
                ? 'Submitting…'
                : schedule.outcome ? 'Submit / update grades' : 'Submit assessment'}
            </button>
            {schedule.assessmentSubmittedAt && (
              <p className="muted-copy">Last submitted {new Date(schedule.assessmentSubmittedAt).toLocaleString()}.</p>
            )}
          </form>
          <ProjectCollaborationPanel groupId={schedule.groupId} role="examiner" />
        </>
      ) : <p className="muted-copy">This defense was cancelled; its assessment can no longer be changed.</p>}
    </section>
  )
}

export default function DefensesPage() {
  const queryClient = useQueryClient()
  const defensesQuery = useQuery({
    queryKey: ['examiner-defenses'],
    queryFn: async () => (await api.get('/projects/examiner/defenses')).data.data,
  })
  const assessmentMutation = useMutation({
    mutationFn: async ({ scheduleId, ...body }) =>
      api.post(`/projects/examiner/defenses/${scheduleId}/assessment`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['examiner-defenses'] }),
  })
  const defenses = defensesQuery.data ?? []

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Defenses and assessments</h1>
          <p className="page-subtitle">Review correction documents, approve them, and submit an individual grade for each student.</p>
        </div>
      </div>
      {defensesQuery.error && <div className="table-error" role="alert">
        {message(defensesQuery.error, 'Could not load assigned defenses')}
      </div>}
      {defensesQuery.isLoading && <div className="table-loading" aria-busy="true">Loading assigned defenses…</div>}
      {defenses.map((schedule) => (
        <ExaminerDefenseCard key={schedule.scheduleId} schedule={schedule}
          assessmentMutation={assessmentMutation} />
      ))}
      {!defensesQuery.isLoading && defenses.length === 0 && (
        <section className="academic-card"><p className="muted-copy">No defenses are assigned to you yet.</p></section>
      )}
    </div>
  )
}
