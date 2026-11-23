// Adds the RACING and RACING 2 pages (and the `buttonbox` connection) to a Companion export, so the Stream Deck
// drives the 16 sim racing buttons of the Companion Button Box. Pure data transform, no dependencies.
//
//   node tools/companion-config/add-racing.mjs <in.companionconfig> <out.companionconfig>
//
// Safe to run again: an existing buttonbox connection is reused, and pages named RACING / RACING 2 are replaced.
// Pages, connections and surfaces that are not part of this are left untouched. Button style is cloned from the
// first button of the GAMING page (minus its icon layer).
import crypto from 'node:crypto'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { MODULE_ENTRY } from './convert.mjs'

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
/** A Companion-style 21 character id. */
export const newId = () => Array.from(crypto.randomBytes(21), (b) => ID_ALPHABET[b % 64]).join('')

const expr = (value) => ({ isExpression: false, value })

export const HOLD_COLOR = 0x8a3b12
export const TAP_COLOR = 0x1f2f5c

/** [label, hold]. Index + 1 is the joystick button number. */
export const BUTTONS = [
	['IGN', false],
	['START', true],
	['PIT', false],
	['LIGHTS', false],
	['FLASH', true],
	['WIPER', false],
	['HORN', true],
	['LOOK BACK', true],
	['TC +', false],
	['TC −', false],
	['ABS +', false],
	['ABS −', false],
	['BB +', false],
	['BB −', false],
	['DRS', false],
	['RADIO', true],
]

export const PAGES = [
	{ name: 'RACING', first: 1 },
	{ name: 'RACING 2', first: 13 },
]

const buttonAction = (connectionId, definitionId, n) => ({
	type: 'action',
	id: newId(),
	definitionId,
	connectionId,
	options: { button: expr(n) },
	upgradeIndex: -1,
})

function makeButton(template, connectionId, n) {
	const [label, hold] = BUTTONS[n - 1]
	const b = structuredClone(template)
	b.style.layers = b.style.layers.filter((l) => l.type !== 'image')
	const box = b.style.layers.find((l) => l.id === 'box0')
	const text = b.style.layers.find((l) => l.id === 'text0')
	box.color = expr(hold ? HOLD_COLOR : TAP_COLOR)
	text.text = expr(label)
	text.y = expr(0)
	text.height = expr(100)
	b.feedbacks = []
	b.localVariables = []
	b.steps = {
		0: {
			action_sets: {
				down: [buttonAction(connectionId, hold ? 'press' : 'tap', n)],
				up: hold ? [buttonAction(connectionId, 'release', n)] : [],
			},
			options: { runWhileHeld: [] },
		},
	}
	return b
}

export function addRacing(input) {
	const config = structuredClone(input)

	const instances = config.instances
	let connectionId = Object.keys(instances).find((id) => instances[id].moduleId === 'buttonbox')
	if (!connectionId) {
		connectionId = newId()
		const sortOrder = Math.max(-1, ...Object.values(instances).map((i) => i.sortOrder ?? 0)) + 1
		instances[connectionId] = {
			moduleInstanceType: 'connection',
			moduleId: 'buttonbox',
			...{ moduleVersionId: MODULE_ENTRY.moduleVersionId, updatePolicy: MODULE_ENTRY.updatePolicy },
			sortOrder,
			label: 'buttonbox',
			isFirstInit: false,
			secrets: {},
			lastUpgradeIndex: MODULE_ENTRY.lastUpgradeIndex,
			enabled: true,
			config: {},
		}
	}

	const gaming = Object.values(config.pages).find((p) => p.name === 'GAMING')
	if (!gaming) throw new Error('no GAMING page to take the button style from')
	const template = Object.values(gaming.controls)
		.flatMap((row) => Object.values(row))
		.find((c) => c.type === 'button-layered')
	if (!template) throw new Error('GAMING has no button to take the style from')

	for (const { name, first } of PAGES) {
		let key = Object.keys(config.pages).find((k) => config.pages[k].name === name)
		if (!key) key = String(Math.max(0, ...Object.keys(config.pages).map(Number)) + 1)
		const controls = { 0: { 0: { type: 'pageup' } }, 1: { 0: { type: 'pagenum' } }, 2: { 0: { type: 'pagedown' } } }
		for (let i = 0; i < 12 && first + i <= BUTTONS.length; i++) {
			controls[Math.floor(i / 4)][(i % 4) + 1] = makeButton(template, connectionId, first + i)
		}
		config.pages[key] = {
			id: config.pages[key]?.id ?? newId(),
			name,
			controls,
			gridSize: structuredClone(gaming.gridSize),
			pageVariables: [],
		}
	}
	return config
}

const readConfig = (file) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'))
const writeConfig = (file, config) => fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(config)))

if (process.argv[1] && import.meta.url === new URL(`file://${fs.realpathSync(process.argv[1])}`).href) {
	const [, , input, output] = process.argv
	if (!input || !output) {
		console.error('usage: node add-racing.mjs <in.companionconfig> <out.companionconfig>')
		process.exit(2)
	}
	const out = addRacing(readConfig(input))
	writeConfig(output, out)
	console.log(`wrote ${output}: pages ${Object.entries(out.pages).map(([k, p]) => `${k}=${p.name}`).join(', ')}`)
}
