export function DashboardStatistics({
  title = 'Statistics',
  statistics,
  loading = false,
  error = false,
  errorMessage = 'Dashboard statistics could not be loaded.',
}) {
  if (!statistics?.length && !loading && !error) return null

  return (
    <section className="dashboard-statistics" aria-labelledby="dashboard-statistics-title" aria-busy={loading}>
      <div className="dashboard-statistics-heading">
        <h2 id="dashboard-statistics-title">{title}</h2>
        <p>Current totals for your workspace.</p>
      </div>
      {error && <p className="dashboard-statistics-error" role="alert">{errorMessage}</p>}
      <div className="dashboard-statistics-grid">
        {(statistics ?? []).map(({ label, value, description, icon: Icon }) => (
          <article className="dashboard-statistic-card" key={label}>
            <span className="dashboard-statistic-icon" aria-hidden="true">
              <Icon size={19} />
            </span>
            <div className="dashboard-statistic-copy">
              <span className="dashboard-statistic-label">{label}</span>
              <strong>{loading ? 'Loading…' : error ? '—' : value}</strong>
              <span className="dashboard-statistic-description">{description}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
