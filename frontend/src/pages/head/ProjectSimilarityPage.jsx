import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import {
  DepartmentPageAlerts,
  DepartmentSelector,
  useHeadDepartmentSelection,
} from './HeadDepartmentWorkspace'

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function ProjectSimilarityPage() {
  const { departments, departmentId, setDepartmentId, enabled } = useHeadDepartmentSelection()
  const queryClient = useQueryClient()
  const similarityQuery = useQuery({
    queryKey: ['head-project-similarity', departmentId],
    enabled,
    queryFn: async () => (await api.get('/projects/similarity', {
      params: { departmentId },
    })).data.data,
  })
  const mutation = useMutation({
    mutationFn: async () => (await api.post('/projects/similarity', { departmentId })).data.data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['head-project-similarity', departmentId] })
      void queryClient.invalidateQueries({ queryKey: ['head-project-reports', departmentId] })
    },
  })
  const similarity = similarityQuery.data?.[0]
  const comparisons = similarity?.results?.comparisons ?? []

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI project similarity</h1>
          <p className="page-subtitle">
            Compare project titles and descriptions. Similarity scores are indicators for review, not plagiarism findings.
          </p>
        </div>
      </div>
      <DepartmentSelector departments={departments} departmentId={departmentId} onChange={setDepartmentId} />
      {!departmentId && <p className="muted-copy">Select one of your assigned departments to continue.</p>}
      <DepartmentPageAlerts errors={[similarityQuery.error]} mutationError={mutation.error} />
      {enabled && (
        <section className="academic-card">
          {similarityQuery.isLoading && <div className="table-loading" aria-busy="true">Loading similarity results…</div>}
          <div className="action-row">
            <button className="btn-primary" disabled={mutation.isPending}
              onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Analyzing projects…' : 'Run AI similarity analysis'}
            </button>
            {similarity && (
              <span className="muted-copy">
                {similarity.results.projectCount} projects · {formatDate(similarity.createdAt)}
              </span>
            )}
          </div>
          {similarity && (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Project one</th><th>Project two</th><th>Cosine similarity</th></tr></thead>
                <tbody>
                  {comparisons.slice(0, 50).map((comparison) => (
                    <tr key={`${comparison.leftSubmissionId}-${comparison.rightSubmissionId}`}>
                      <td>{comparison.leftTitle}</td>
                      <td>{comparison.rightTitle}</td>
                      <td>{Number(comparison.score).toFixed(3)}</td>
                    </tr>
                  ))}
                  {comparisons.length === 0 && (
                    <tr><td className="table-empty" colSpan={3}>Submit at least two project titles to compare.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
