import test from 'node:test'
import assert from 'node:assert/strict'
import { isAwaitingAutomaticReview } from '../src/modules/projects/projects.service.js'

test('only unreviewed submitted proposals are eligible for automatic similarity review', () => {
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
  }), false)
  assert.equal(isAwaitingAutomaticReview({
    submissionStatus: 'submitted',
    submissionId: null,
    reviewNote: null,
  }), false)
})
