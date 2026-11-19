import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readRootAtoms, type CreateClientFn } from './atoms.js'
import type { XClient, XDisplay, XProperty } from 'x11'

interface FakeAtom {
	id: number
	name: string
	format?: number
	values?: number[]
	failName?: boolean
	failProperty?: boolean
}

function cardinalBuffer(values: number[]): Buffer {
	const buf = Buffer.alloc(values.length * 4)
	values.forEach((value, i) => buf.writeUInt32LE(value, i * 4))
	return buf
}

function makeFakeClient(atoms: FakeAtom[]): { client: XClient; getTerminated: () => number } {
	let terminated = 0
	const client: XClient = {
		ListProperties(_wid, cb) {
			queueMicrotask(() =>
				cb(
					null,
					atoms.map((a) => a.id),
				),
			)
		},
		GetAtomName(atom, cb) {
			const found = atoms.find((a) => a.id === atom)
			queueMicrotask(() => {
				if (!found || found.failName) cb(new Error('GetAtomName failed'), '')
				else cb(null, found.name)
			})
		},
		GetProperty(_del, _wid, name, _type, _longOffset, _longLength, cb) {
			const found = atoms.find((a) => a.id === name)
			queueMicrotask(() => {
				if (!found || found.failProperty) cb(new Error('GetProperty failed'), undefined as unknown as XProperty)
				else
					cb(null, {
						type: 0,
						format: found.format ?? 32,
						bytesAfter: 0,
						data: cardinalBuffer(found.values ?? []),
					})
			})
		},
		terminate() {
			terminated += 1
		},
	}
	return { client, getTerminated: () => terminated }
}

function okCreateClientFn(client: XClient): CreateClientFn {
	const display: XDisplay = { client, screen: [{ root: 1 }] }
	return (_options, cb) => {
		queueMicrotask(() => cb(null, display))
		return client
	}
}

test('decodes CARDINAL properties whose atom name contains FEEDBACK, ignoring other properties', async () => {
	const { client, getTerminated } = makeFakeClient([
		{ id: 1, name: 'GAMESCOPE_HDR_OUTPUT_FEEDBACK', values: [1] },
		{ id: 2, name: 'GAMESCOPE_VRR_FEEDBACK', values: [0] },
		{ id: 3, name: '_NET_WM_NAME' },
	])

	const result = await readRootAtoms(':1', 1000, okCreateClientFn(client))

	assert.deepEqual(result, { GAMESCOPE_HDR_OUTPUT_FEEDBACK: [1], GAMESCOPE_VRR_FEEDBACK: [0] })
	assert.equal(getTerminated(), 1)
})

test('skips an atom whose name cannot be resolved and still returns the rest', async () => {
	const { client } = makeFakeClient([
		{ id: 1, name: 'GAMESCOPE_HDR_OUTPUT_FEEDBACK', values: [1], failName: true },
		{ id: 2, name: 'GAMESCOPE_VRR_FEEDBACK', values: [7] },
	])

	const result = await readRootAtoms(':1', 1000, okCreateClientFn(client))

	assert.deepEqual(result, { GAMESCOPE_VRR_FEEDBACK: [7] })
})

test('skips a matching atom whose GetProperty call fails', async () => {
	const { client } = makeFakeClient([{ id: 1, name: 'GAMESCOPE_HDR_OUTPUT_FEEDBACK', values: [1], failProperty: true }])

	const result = await readRootAtoms(':1', 1000, okCreateClientFn(client))

	assert.deepEqual(result, {})
})

test('skips a FEEDBACK property that is not stored as CARDINAL (format 32)', async () => {
	const { client } = makeFakeClient([{ id: 1, name: 'SOME_FEEDBACK', format: 8, values: [1] }])

	const result = await readRootAtoms(':1', 1000, okCreateClientFn(client))

	assert.deepEqual(result, {})
})

test('rejects when the connection itself fails, without calling terminate', async () => {
	const createClientFn: CreateClientFn = (_options, cb) => {
		queueMicrotask(() => cb(new Error('connection refused'), undefined as unknown as XDisplay))
		return undefined as unknown as XClient
	}

	await assert.rejects(readRootAtoms(':99', 1000, createClientFn), /connection refused/)
})

test('rejects with a timeout when the connection callback never fires', async () => {
	const createClientFn: CreateClientFn = () => undefined as unknown as XClient

	await assert.rejects(readRootAtoms(':99', 15, createClientFn), /timed out/)
})
