import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default function ProjectDefenseSchedulePage() {
  const defensesQuery = useQuery({
    queryKey: ['student-defenses'],
    queryFn: async () => (await api.get('/projects/mine/defenses')).data.data,
    refetchInterval: 15000,
  })

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Defense schedule</h1>
          <p className="page-subtitle">View your defense date, venue, chairperson, examiner feedback, and your grade.</p>
        </div>
      </div>
      {defensesQuery.error && <div className="table-error" role="alert">
        {message(defensesQuery.error, 'Could not load defense schedules')}
      </div>}
      {defensesQuery.isLoading && <div className="table-loading" aria-busy="true">Loading defense schedules…</div>}
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Group</th><th>Defense</th><th>Date and time</th><th>Venue</th><th>Status</th><th>Examiners and results</th></tr></thead>
          <tbody>{(defensesQuery.data ?? []).map((schedule) => (
            <tr key={schedule.id}>
              <td>{schedule.groupName}</td><td>{schedule.defenseType}</td>
              <td>{new Date(schedule.scheduledAt).toLocaleString()}</td><td>{schedule.venue}</td><td>{schedule.status}</td>
              <td>
                {schedule.examiners?.map((examiner) => (
                  <p key={examiner.userId}>
                    {examiner.fullName} · {examiner.assignmentMethod === 'ai' ? 'AI assigned' : 'assigned'}
                    {examiner.isChairperson ? ' · Chairperson' : ''}
                  </p>
                ))}
                {schedule.results?.map((result) => (
                  <div key={result.id}>
                    <strong>{result.examinerName}: {result.outcome.replaceAll('_', ' ')}</strong>
                    {result.comments && <p>{result.comments}</p>}
                    {result.studentGrades?.map((grade) => (
                      <p key={grade.studentUserId}>Your grade: {grade.grade} / 100</p>
                    ))}
                    {result.rubric && <pre>{JSON.stringify(result.rubric, null, 2)}</pre>}
                  </div>
                ))}
                {!schedule.examiners?.length && !schedule.results?.length && 'No examiner results yet.'}
              </td>
            </tr>
          ))}
            {defensesQuery.data?.length === 0 && (
              <tr><td className="table-empty" colSpan={6}>No defenses are scheduled for your groups.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
