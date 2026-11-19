import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

export function RouteErrorPage() {
  const error = useRouteError()
  const heading = isRouteErrorResponse(error) ? `Page error (${error.status})` : 'This page could not be displayed'

  return (
    <main className="route-error-page">
      <section className="route-error-card" role="alert">
        <h1>{heading}</h1>
        <p>Something went wrong while loading this page. You can return to your dashboard or reload the application.</p>
        <div className="action-row">
          <Link className="btn-primary" to="/">Go to dashboard</Link>
          <button className="btn-secondary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </section>
    </main>
  )
}
