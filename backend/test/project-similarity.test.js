import test from 'node:test'
import assert from 'node:assert/strict'
import { localTfidfSimilarity } from '../src/modules/projects/ai-client.js'

test('local TF-IDF similarity ranks shared project terms above unrelated text', () => {
  const result = localTfidfSimilarity([
    { id: 'one', text: 'Machine learning for crop disease detection' },
    { id: 'two', text: 'Machine learning detects disease in crops' },
    { id: 'three', text: 'A campus bus tracking application' },
  ], [
    { leftId: 'one', rightId: 'two' },
    { leftId: 'one', rightId: 'three' },
  ])

  assert.match(result.modelName, /lexical baseline/)
  assert.ok(result.scores[0].score > result.scores[1].score)
  assert.ok(result.scores.every(({ score }) => score >= 0 && score <= 1))
})
