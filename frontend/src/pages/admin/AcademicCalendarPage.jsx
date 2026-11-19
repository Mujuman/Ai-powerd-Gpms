import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'

const initialYear = { label: '', startDate: '', endDate: '' }
const initialSemester = { name: 'first', startDate: '', endDate: '' }

function requestError(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

export default function AcademicCalendarPage() {
  const queryClient = useQueryClient()
  const [yearForm, setYearForm] = useState(initialYear)
  const [semesterForm, setSemesterForm] = useState(initialSemester)
  const [selectedYearId, setSelectedYearId] = useState('')
  const [message, setMessage] = useState('')

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => (await api.get('/academics/years')).data.data,
  })
  const years = yearsQuery.data?.data ?? []
  const selectedYear = years.find((year) => year.id === selectedYearId) ?? years[0]
  const semestersQuery = useQuery({
    queryKey: ['semesters', selectedYear?.id],
    enabled: Boolean(selectedYear?.id),
    queryFn: async () => (await api.get('/academics/semesters', {
      params: { academicYearId: selectedYear.id },
    })).data.data.semesters,
  })

  const yearMutation = useMutation({
    mutationFn: async (body) => (await api.post('/academics/years', body)).data,
    onSuccess: () => {
      setYearForm(initialYear)
      setMessage('Academic year created.')
      void queryClient.invalidateQueries({ queryKey: ['academic-years'] })
    },
  })
  const activateYearMutation = useMutation({
    mutationFn: ({ id, active }) => api.post(`/academics/years/${id}/${active ? 'activate' : 'deactivate'}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['academic-years'] }),
  })
  const semesterMutation = useMutation({
    mutationFn: async (body) => (await api.post('/academics/semesters', body)).data,
    onSuccess: () => {
      setSemesterForm(initialSemester)
      setMessage('Semester created.')
      void queryClient.invalidateQueries({ queryKey: ['semesters', selectedYear?.id] })
    },
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.post(`/academics/semesters/${id}/status`, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['semesters', selectedYear?.id] }),
  })

  function submitYear(event) {
    event.preventDefault()
    setMessage('')
    yearMutation.mutate(yearForm)
  }

  function submitSemester(event) {
    event.preventDefault()
    if (!selectedYear) return
    setMessage('')
    semesterMutation.mutate({ ...semesterForm, academicYearId: selectedYear.id })
  }

  const error = yearsQuery.error
    ? requestError(yearsQuery.error, 'Could not load academic years')
    : yearsQuery.isError
      ? 'Could not load academic years'
      : yearMutation.error
        ? requestError(yearMutation.error, 'Could not create academic year')
        : semesterMutation.error
          ? requestError(semesterMutation.error, 'Could not create semester')
          : activateYearMutation.error || statusMutation.error
            ? requestError(activateYearMutation.error ?? statusMutation.error, 'Could not update calendar status')
            : null

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Academic Calendar</h1>
          <p className="page-subtitle">Configure academic years and semesters for your institution.</p>
        </div>
      </div>

      {message && <div className="status-active" role="status">{message}</div>}
      {error && <div className="table-error" role="alert">{error}</div>}

      <section className="academic-card">
        <h2 className="section-title">Create academic year</h2>
        <form className="academic-form-grid" onSubmit={submitYear}>
          <label className="form-field">
            <span className="form-label">Label (YYYY-YYYY)</span>
            <input className="form-input" required pattern="\d{4}-\d{4}" placeholder="2026-2027"
              value={yearForm.label} onChange={(event) => setYearForm({ ...yearForm, label: event.target.value })} />
          </label>
          <label className="form-field">
            <span className="form-label">Start date</span>
            <input className="form-input" type="date" required value={yearForm.startDate}
              onChange={(event) => setYearForm({ ...yearForm, startDate: event.target.value })} />
          </label>
          <label className="form-field">
            <span className="form-label">End date</span>
            <input className="form-input" type="date" required value={yearForm.endDate}
              onChange={(event) => setYearForm({ ...yearForm, endDate: event.target.value })} />
          </label>
          <button className="btn-primary" disabled={yearMutation.isPending}>
            {yearMutation.isPending ? 'Creating…' : 'Create year'}
          </button>
        </form>
      </section>

      <section className="academic-card">
        <div className="page-header">
          <div>
            <h2 className="section-title">Academic years</h2>
            <p className="page-subtitle">Only one academic year may be active at a time.</p>
          </div>
        </div>
        {yearsQuery.isLoading && <div className="table-loading" aria-busy="true">Loading academic years…</div>}
        {!yearsQuery.isLoading && years.length === 0 && <p className="muted-copy">No academic years configured yet.</p>}
        {years.length > 0 && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Academic year</th><th>Dates</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {years.map((year) => (
                  <tr key={year.id}>
                    <td>{year.label}</td>
                    <td>{String(year.startDate).slice(0, 10)} — {String(year.endDate).slice(0, 10)}</td>
                    <td><span className={year.isActive ? 'status-active' : 'status-inactive'}>{year.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button className="btn-secondary" disabled={activateYearMutation.isPending}
                        onClick={() => activateYearMutation.mutate({ id: year.id, active: !year.isActive })}>
                        {year.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="academic-card">
        <div className="page-header">
          <div>
            <h2 className="section-title">Semesters</h2>
            <p className="page-subtitle">Each semester belongs to one academic year.</p>
          </div>
          <select className="form-input calendar-year-select" aria-label="Select academic year"
            value={selectedYear?.id ?? ''} onChange={(event) => setSelectedYearId(event.target.value)}>
            {years.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}
          </select>
        </div>
        {!selectedYear && <p className="muted-copy">Create an academic year before adding semesters.</p>}
        {selectedYear && (
          <>
            <form className="academic-form-grid" onSubmit={submitSemester}>
              <label className="form-field">
                <span className="form-label">Semester</span>
                <select className="form-input" value={semesterForm.name}
                  onChange={(event) => setSemesterForm({ ...semesterForm, name: event.target.value })}>
                  <option value="first">First</option>
                  <option value="second">Second</option>
                  <option value="summer">Summer</option>
                </select>
              </label>
              <label className="form-field">
                <span className="form-label">Start date</span>
                <input className="form-input" type="date" required value={semesterForm.startDate}
                  onChange={(event) => setSemesterForm({ ...semesterForm, startDate: event.target.value })} />
              </label>
              <label className="form-field">
                <span className="form-label">End date</span>
                <input className="form-input" type="date" required value={semesterForm.endDate}
                  onChange={(event) => setSemesterForm({ ...semesterForm, endDate: event.target.value })} />
              </label>
              <button className="btn-primary" disabled={semesterMutation.isPending}>
                {semesterMutation.isPending ? 'Creating…' : 'Add semester'}
              </button>
            </form>
            {semestersQuery.isError && <div className="table-error" role="alert">{requestError(semestersQuery.error, 'Could not load semesters')}</div>}
            {semestersQuery.isLoading && <div className="table-loading" aria-busy="true">Loading semesters…</div>}
            {!semestersQuery.isLoading && semestersQuery.data?.length === 0 && <p className="muted-copy">No semesters configured for this year.</p>}
            {semestersQuery.data?.length > 0 && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Semester</th><th>Dates</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {semestersQuery.data.map((semester) => (
                      <tr key={semester.id}>
                        <td>{semester.name}</td>
                        <td>{String(semester.startDate).slice(0, 10)} — {String(semester.endDate).slice(0, 10)}</td>
                        <td><span className={semester.status === 'active' ? 'status-active' : 'status-inactive'}>{semester.status}</span></td>
                        <td>
                          {semester.status !== 'closed' && (
                            <button className="btn-secondary" disabled={statusMutation.isPending || !selectedYear.isActive}
                              title={!selectedYear.isActive ? 'Activate the academic year first' : ''}
                              onClick={() => statusMutation.mutate({ id: semester.id, status: semester.status === 'active' ? 'closed' : 'active' })}>
                              {semester.status === 'active' ? 'Close' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
