import { config } from '../../config/env.js'
import { HttpError } from '../../utils/http-error.js'

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in',
  'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'with',
])

export function localTfidfSimilarity(items, pairs) {
  const documents = items.map(({ text }) => {
    const terms = String(text).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
    const tokens = []
    for (let index = 0; index < terms.length; index += 1) {
      const current = terms[index]
      if (!STOP_WORDS.has(current)) tokens.push(current)
      const next = terms[index + 1]
      if (next && !STOP_WORDS.has(current) && !STOP_WORDS.has(next)) {
        tokens.push(`${current}_${next}`)
      }
    }
    const counts = new Map()
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
    return counts
  })

  const documentFrequency = new Map()
  for (const document of documents) {
    for (const token of document.keys()) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1)
    }
  }
  const vectors = documents.map((document) => {
    const vector = new Map()
    for (const [token, count] of document) {
      const inverseFrequency = Math.log((documents.length + 1) / (documentFrequency.get(token) + 1)) + 1
      vector.set(token, (1 + Math.log(count)) * inverseFrequency)
    }
    const norm = Math.sqrt([...vector.values()].reduce((sum, weight) => sum + weight ** 2, 0))
    if (norm) for (const [token, weight] of vector) vector.set(token, weight / norm)
    return vector
  })
  const index = new Map(items.map((item, position) => [item.id, position]))
  const scores = pairs.map(({ leftId, rightId }) => {
    const left = vectors[index.get(leftId)]
    const right = vectors[index.get(rightId)]
    let score = 0
    for (const [token, weight] of left) score += weight * (right.get(token) ?? 0)
    return { leftId, rightId, score }
  })
  return { modelName: 'local-tfidf-cosine-v1 (lexical baseline)', scores }
}

export async function analyzeSimilarity(items, pairs) {
  if (!config.aiServiceToken
    || config.aiServiceToken === 'replace-with-a-separate-random-internal-token') {
    return localTfidfSimilarity(items, pairs)
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
