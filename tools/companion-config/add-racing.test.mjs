import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addRacing } from './add-racing.mjs'

const expr = (value) => ({ isExpression: false, value })
const gamingButton = (text) => ({
	type: 'button-layered',
	style: {
		layers: [
			{ id: 'canvas', type: 'canvas' },
			{ id: 'box0', type: 'box', color: expr(1) },
			{ id: 'image0', type: 'image', base64Image: expr('$(image:x)') },
			{ id: 'text0', type: 'text', text: expr(text), y: expr(56), height: expr(42) },
		],
	},
	options: {},
	feedbacks: [{ type: 'feedback', id: 'fb' }],
	steps: { 0: { action_sets: { down: [{ type: 'action', id: 'a', definitionId: 'x', connectionId: 'm' }], up: [] }, options: {} } },
	localVariables: [],
})
const fixture = () => ({
	version: 12,
	instances: { m: { moduleInstanceType: 'connection', moduleId: 'linux-media', label: 'media', sortOrder: 0, config: {} } },
	pages: {
		1: { id: 'p1', name: 'MUSIC', gridSize: { maxColumn: 7 }, controls: { 0: { 0: { type: 'pageup' } } }, pageVariables: [] },
		3: {
			id: 'p3',
			name: 'GAMING',
			gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 },
			controls: {
				0: { 0: { type: 'pageup' }, 1: gamingButton('BAR') },
				1: { 0: { type: 'pagenum' } },
				2: { 0: { type: 'pagedown' } },
			},
			pageVariables: [],
		},
	},
	surfaces: { s1: { name: 'deck' } },
})

const actionsOf = (b, set) => b.steps[0].action_sets[set].map((a) => `${a.definitionId} ${a.options.button.value}`)

test('adds a buttonbox connection', () => {
	const out = addRacing(fixture())
	const boxes = Object.values(out.instances).filter((i) => i.moduleId === 'buttonbox')
	assert.equal(boxes.length, 1)
	assert.equal(boxes[0].label, 'buttonbox')
	assert.equal(boxes[0].enabled, true)
	assert.match(Object.keys(out.instances).find((k) => out.instances[k] === boxes[0]), /^[A-Za-z0-9_-]{21}$/)
})

test('adds RACING and RACING 2 as pages 4 and 5', () => {
	const out = addRacing(fixture())
	assert.equal(out.pages[4].name, 'RACING')
	assert.equal(out.pages[5].name, 'RACING 2')
	for (const n of [4, 5]) {
		assert.deepEqual(out.pages[n].gridSize, fixture().pages[3].gridSize)
		assert.equal(out.pages[n].controls[0][0].type, 'pageup')
		assert.equal(out.pages[n].controls[1][0].type, 'pagenum')
		assert.equal(out.pages[n].controls[2][0].type, 'pagedown')
	}
})

const LABELS = ['IGN', 'START', 'PIT', 'LIGHTS', 'FLASH', 'WIPER', 'HORN', 'LOOK BACK', 'TC +', 'TC −', 'ABS +', 'ABS −', 'BB +', 'BB −', 'DRS', 'RADIO']
const HOLD = new Set([2, 5, 7, 8, 16])

test('button mapping', () => {
	const out = addRacing(fixture())
	const connectionId = Object.keys(out.instances).find((k) => out.instances[k].moduleId === 'buttonbox')
	for (let n = 1; n <= 16; n++) {
		const page = n <= 12 ? out.pages[4] : out.pages[5]
		const i = (n - 1) % 12
		const b = page.controls[Math.floor(i / 4)][(i % 4) + 1]
		assert.equal(b.style.layers.find((l) => l.id === 'text0').text.value, LABELS[n - 1], `label ${n}`)
		assert.deepEqual(b.feedbacks, [])
		assert.equal(b.steps[0].action_sets.down[0].connectionId, connectionId)
		if (HOLD.has(n)) {
			assert.deepEqual(actionsOf(b, 'down'), [`press ${n}`])
			assert.deepEqual(actionsOf(b, 'up'), [`release ${n}`])
		} else {
			assert.deepEqual(actionsOf(b, 'down'), [`tap ${n}`])
			assert.deepEqual(actionsOf(b, 'up'), [])
		}
	}
	const color = (n) => out.pages[4].controls[Math.floor((n - 1) / 4)][((n - 1) % 4) + 1].style.layers.find((l) => l.id === 'box0').color.value
	assert.notEqual(color(2), color(1))
	assert.equal(color(2), color(5))
	assert.equal(color(1), color(3))
	// RACING 2: only row 0 used, rows 1-2 hold just the nav keys
	assert.deepEqual(Object.keys(out.pages[5].controls[0]), ['0', '1', '2', '3', '4'])
	assert.deepEqual(Object.keys(out.pages[5].controls[1]), ['0'])
	assert.deepEqual(Object.keys(out.pages[5].controls[2]), ['0'])
	// no icon layer cloned from GAMING
	assert.equal(out.pages[4].controls[0][1].style.layers.some((l) => l.type === 'image'), false)
})

const stripIds = (c) => JSON.parse(JSON.stringify(c, (k, v) => (k === 'id' ? undefined : v)))

test('idempotent', () => {
	const once = addRacing(fixture())
	const twice = addRacing(once)
	assert.equal(Object.keys(twice.pages).length, 4)
	assert.equal(Object.values(twice.instances).filter((i) => i.moduleId === 'buttonbox').length, 1)
	assert.deepEqual(Object.keys(twice.instances), Object.keys(once.instances))
	assert.equal(twice.pages[4].id, once.pages[4].id)
	const connectionId = Object.keys(once.instances).find((k) => once.instances[k].moduleId === 'buttonbox')
	assert.equal(twice.pages[4].controls[0][1].steps[0].action_sets.down[0].connectionId, connectionId)
	assert.deepEqual(stripIds(twice), stripIds(once))
})

test('leaves pages 1-3, other instances and surfaces untouched', () => {
	const before = fixture()
	const out = addRacing(before)
	for (const n of [1, 3]) assert.deepEqual(out.pages[n], before.pages[n])
	assert.deepEqual(out.instances.m, before.instances.m)
	assert.deepEqual(out.surfaces, before.surfaces)
	assert.equal(out.version, 12)
})
