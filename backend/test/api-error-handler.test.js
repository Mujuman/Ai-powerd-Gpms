import test from 'node:test'
import assert from 'node:assert/strict'
import { apiErrorHandler } from '../src/utils/api-error-handler.js'
import { HttpError } from '../src/utils/http-error.js'

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

test('known AI service errors preserve their status and actionable message', () => {
  const response = createResponse()
  apiErrorHandler(
    new HttpError(503, 'Local title generation service is unavailable; start it and try again'),
    {},
    response,
    () => assert.fail('next should not be called when headers are available'),
  )

  assert.equal(response.statusCode, 503)
  assert.equal(response.body.message, 'Local title generation service is unavailable; start it and try again')
})
