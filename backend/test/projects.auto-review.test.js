import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isAwaitingAutomaticReview,
  selectAiAdvisorCandidate,
} from '../src/modules/projects/projects.service.js'

test('unreviewed and previously flagged submitted proposals are eligible for automatic similarity review', () => {
  assert.equal(isAwaitingAutomaticReview({
    submissionStatus: 'submitted',
    submissionId: 'submission-id',
    reviewNote: null,
  }), true)

  assert.equal(isAwaitingAutomaticReview({
    submissionStatus: 'approved',
    submissionId: 'submission-id',
    reviewNote: 'Automatically approved: no approved projects were available for comparison.',
    advisorName: null,
  }), false)
  assert.equal(isAwaitingAutomaticReview({
    submissionStatus: 'submitted',
    submissionId: 'submission-id',
    reviewNote: 'Automatic similarity check: above threshold.',
  }), true)
  assert.equal(isAwaitingAutomaticReview({
    submissionStatus: 'submitted',
    submissionId: 'submission-id',
    reviewNote: 'Department Head review note.',
  }), false)
  assert.equal(isAwaitingAutomaticReview({
    submissionStatus: 'submitted',
    submissionId: null,
    reviewNote: null,
  }), false)
})

test('AI advisor selection favors project relevance, then lower workload', () => {
  const candidates = [
    { userId: 'busy', fullName: 'A. Advisor', activeWorkload: 8 },
    { userId: 'lighter', fullName: 'Z. Advisor', activeWorkload: 1 },
    { userId: 'tie', fullName: 'B. Advisor', activeWorkload: 1 },
  ]
  const scores = new Map([
    ['busy', 0.9],
    ['lighter', 0.8],
    ['tie', 0.8],
  ])

  assert.equal(selectAiAdvisorCandidate(candidates, scores).userId, 'busy')
  assert.equal(selectAiAdvisorCandidate(candidates.slice(1), scores).userId, 'tie')
  assert.equal(selectAiAdvisorCandidate(candidates, new Map()), null)
})
