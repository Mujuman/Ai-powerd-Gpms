import { config } from '../../config/env.js'
import { HttpError } from '../../utils/http-error.js'

export async function analyzeSimilarity(items, pairs) {
  if (!config.aiServiceToken) {
    throw new HttpError(503, 'Configure AI_SERVICE_TOKEN to use project similarity and AI assignment')
  }

  let response
  try {
    response = await fetch(`${config.aiServiceUrl.replace(/\/+$/, '')}/api/v1/similarity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Service-Token': config.aiServiceToken,
      },
      body: JSON.stringify({ items, pairs }),
      signal: AbortSignal.timeout(60000),
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new HttpError(503, 'AI similarity analysis timed out; try again with fewer active projects')
    }
    throw new HttpError(503, 'AI similarity service is unavailable')
  }

  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const message = typeof result?.detail === 'string'
      ? result.detail
      : 'AI similarity service rejected the analysis request'
    throw new HttpError(response.status === 503 ? 503 : 502, message)
  }
  if (typeof result?.modelName !== 'string' || !Array.isArray(result.scores)) {
    throw new HttpError(502, 'AI similarity service returned an invalid response')
  }
  return result
}
