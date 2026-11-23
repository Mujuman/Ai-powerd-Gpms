import test from 'node:test'
import assert from 'node:assert/strict'
import { selectAiAdvisorCandidate } from '../src/modules/projects/projects.service.js'

test('AI advisor selection prioritizes similarity, then workload and stable name order', () => {
  const candidates = [
    { userId: 'busy', fullName: 'A. Advisor', activeWorkload: 8 },
    { userId: 'lighter', fullName: 'Z. Advisor', activeWorkload: 1 },
    { userId: 'tie', fullName: 'B. Advisor', activeWorkload: 1 },
    { userId: 'unscored', fullName: 'Available Advisor', activeWorkload: 0 },
  ]
  const selected = selectAiAdvisorCandidate(candidates, new Map([
    ['busy', 0.9],
    ['lighter', 0.8],
    ['tie', 0.8],
  ]))

  assert.equal(selected.userId, 'busy')
  assert.equal(selectAiAdvisorCandidate(candidates.slice(1), new Map([
    ['lighter', 0.8],
    ['tie', 0.8],
  ])).userId, 'tie')
  assert.equal(selectAiAdvisorCandidate(candidates, new Map()), null)
})
