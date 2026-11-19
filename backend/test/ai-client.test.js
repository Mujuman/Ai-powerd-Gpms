import assert from 'node:assert/strict'
import { test } from 'node:test'
import { config } from '../src/config/env.js'
import { analyzeSimilarity } from '../src/modules/projects/ai-client.js'

test('AI similarity responses must contain one valid score for every requested pair', async () => {
  const originalFetch = globalThis.fetch
  const originalToken = config.aiServiceToken
  const items = [{ id: 'one', text: 'first project' }, { id: 'two', text: 'second project' }]
  const pairs = [{ leftId: 'one', rightId: 'two' }]

  config.aiServiceToken = 'test-internal-token'
  try {
    for (const body of [
      { modelName: 'test-model', scores: [] },
      { modelName: 'test-model', scores: [{ leftId: 'unexpected', rightId: 'two', score: 0.5 }] },
      { modelName: 'test-model', scores: [{ leftId: 'one', rightId: 'two', score: '0.5' }] },
    ]) {
      globalThis.fetch = async () => new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
      await assert.rejects(
        analyzeSimilarity(items, pairs),
        (error) => error.status === 502,
      )
    }
  } finally {
    globalThis.fetch = originalFetch
    config.aiServiceToken = originalToken
  }
})
