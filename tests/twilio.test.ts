import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyTwilioSignature } from '../lib/security/twilio.ts'

const URL = 'https://adminos.co.za/api/voice/inbound'
const PARAMS = { CallSid: 'CA123', From: '+27820000000', To: '+27110000000' }

function sign(token: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params).sort().reduce((a, k) => a + k + params[k], url)
  return createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64')
}

test('fails closed when TWILIO_AUTH_TOKEN is not set', () => {
  delete process.env.TWILIO_AUTH_TOKEN
  assert.equal(verifyTwilioSignature(URL, PARAMS, sign('anything', URL, PARAMS)), false)
})

test('accepts a correctly signed request', () => {
  process.env.TWILIO_AUTH_TOKEN = 'test_token'
  assert.equal(verifyTwilioSignature(URL, PARAMS, sign('test_token', URL, PARAMS)), true)
})

test('rejects a tampered parameter', () => {
  process.env.TWILIO_AUTH_TOKEN = 'test_token'
  const good = sign('test_token', URL, PARAMS)
  assert.equal(verifyTwilioSignature(URL, { ...PARAMS, From: '+27829999999' }, good), false)
})

test('rejects a wrong signing key and a missing header', () => {
  process.env.TWILIO_AUTH_TOKEN = 'test_token'
  assert.equal(verifyTwilioSignature(URL, PARAMS, sign('wrong_token', URL, PARAMS)), false)
  assert.equal(verifyTwilioSignature(URL, PARAMS, null), false)
})
