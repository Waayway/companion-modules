import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unwrapVariant } from './variant.js'

void test('unwrapVariant unwraps a Variant-shaped value', () => {
	assert.equal(unwrapVariant({ signature: 's', value: 'hello' }), 'hello')
})

void test('unwrapVariant passes through already-plain values', () => {
	assert.equal(unwrapVariant('hello'), 'hello')
	assert.equal(unwrapVariant(42), 42)
	assert.equal(unwrapVariant(null), null)
	assert.equal(unwrapVariant(undefined), undefined)
})

void test('unwrapVariant does not unwrap a plain object that merely has a value key', () => {
	const input = { value: 'not a variant' }
	assert.equal(unwrapVariant(input), input)
})
