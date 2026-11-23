import assert from 'node:assert/strict'
import { test } from 'node:test'
import { convert, rewriteVariables, stableId } from './convert.mjs'

const expr = (value) => ({ isExpression: false, value })
const action = (id, conn, url) => ({
	type: 'action',
	id,
	definitionId: 'get',
	connectionId: conn,
	options: { url: expr(`http://127.0.0.1:8899${url}`), header: expr('') },
	upgradeIndex: 3,
})
const variableFeedback = (variable, value) => ({
	type: 'feedback',
	id: `fb-${variable.replace(':', '_')}-${value}`,
	definitionId: 'variable_value',
	connectionId: 'internal',
	options: { variable: expr(variable), op: expr('eq'), value: expr(value) },
	isInverted: expr(false),
	children: {},
	styleOverrides: [{ overrideId: 'o1', elementId: 'text0', elementProperty: 'text', override: expr('$(custom:mh_preset_name) x') }],
})
const button = (text, actions, feedbacks = []) => ({
	type: 'button-layered',
	style: { layers: [{ id: 'text0', type: 'text', text: expr(text) }] },
	steps: { 0: { action_sets: { down: actions, up: [] }, options: { runWhileHeld: [] } } },
	feedbacks,
})

function oldConfig() {
	return {
		version: 12,
		type: 'full',
		instances: {
			HTTP: { moduleId: 'generic-http', label: 'bridge', config: { prefix: '' }, secrets: {}, sortOrder: 0 },
			DISCORD: {
				moduleId: 'discord-api',
				label: 'discord',
				config: { clientID: 'id', clientSecret: 'SECRET-VALUE', accessToken: 'TOKEN-VALUE' },
				secrets: {},
				sortOrder: 3,
			},
		},
		custom_variables: { mp_status: { defaultValue: '' } },
		customVariablesCollections: [],
		pages: {
			1: {
				name: 'MUSIC',
				controls: {
					0: {
						0: button('$(custom:mp_title)', [action('a1', 'HTTP', '/music/play-pause')], [variableFeedback('custom:mp_status', 'Playing')]),
						1: button('SYS $(custom:sys_volume)%', []),
						2: button('MUTE', [action('a2', 'HTTP', '/music/sys-mute')]),
						3: button('BAR', [action('a3', 'HTTP', '/preset/2')]),
						4: button('GAME', [], [variableFeedback('custom:gamemode', 'on'), variableFeedback('custom:gamemode', 'req')]),
						5: button('LOOP', [action('a5', 'HTTP', '/music/loop'), action('a6', 'HTTP', '/music/vol-up')]),
						6: { type: 'pageup' },
						7: button('MUTE-DISCORD', [{ type: 'action', id: 'd1', definitionId: 'selfMute', connectionId: 'DISCORD', options: {} }]),
					},
				},
			},
		},
	}
}

test('replaces the bridge by the two module connections and keeps other connections', () => {
	const { config } = convert(oldConfig())
	const labels = Object.values(config.instances).map((i) => `${i.moduleId}:${i.label}`)
	assert.deepEqual(labels.sort(), ['discord-api:discord', 'linux-media:media', 'mangohud:mangohud'])
	assert.equal(config.instances.HTTP, undefined)
})

test('scrubs credentials of other connections', () => {
	const { config, report } = convert(oldConfig())
	assert.equal(JSON.stringify(config).includes('SECRET-VALUE'), false)
	assert.equal(JSON.stringify(config).includes('TOKEN-VALUE'), false)
	assert.equal(report.scrubbed.length, 1)
	assert.deepEqual(config.instances.DISCORD.config, {})
})

test('rewrites actions to the module actions with options', () => {
	const { config } = convert(oldConfig())
	const row = config.pages[1].controls[0]
	const media = stableId('media')
	const mango = stableId('mangohud')
	const a1 = row[0].steps[0].action_sets.down[0]
	assert.deepEqual([a1.connectionId, a1.definitionId, a1.options], [media, 'playpause', {}])
	const preset = row[3].steps[0].action_sets.down[0]
	assert.deepEqual([preset.connectionId, preset.definitionId, preset.options], [mango, 'set_preset', { preset: expr(2) }])
	const [loop, vol] = row[5].steps[0].action_sets.down
	assert.deepEqual(loop.options, { mode: expr('cycle') })
	assert.deepEqual([vol.definitionId, vol.options], ['volume_up', { step: expr(5) }])
	assert.equal(a1.id, 'a1', 'action ids are kept')
})

test('rewrites variable references in text, feedbacks and style overrides', () => {
	const { config } = convert(oldConfig())
	const b = config.pages[1].controls[0][0]
	assert.equal(b.style.layers[0].text.value, '$(media:title)')
	assert.equal(b.feedbacks[0].options.variable.value, 'media:status')
	assert.equal(b.feedbacks[0].styleOverrides[0].override.value, '$(mangohud:preset_name) x')
	assert.equal(JSON.stringify(config).includes('custom:'), false)
})

test('removes system-audio buttons and the never-reported gamemode "req" feedback', () => {
	const { config, report } = convert(oldConfig())
	const row = config.pages[1].controls[0]
	assert.equal(row[1], undefined)
	assert.equal(row[2], undefined)
	assert.equal(report.removedButtons.length, 2)
	assert.equal(row[4].feedbacks.length, 1)
	assert.equal(row[4].feedbacks[0].options.value.value, 'on')
	assert.deepEqual(config.pages[1].controls[0][6], { type: 'pageup' })
})

test('leaves buttons of other connections untouched', () => {
	const { config } = convert(oldConfig())
	assert.deepEqual(config.pages[1].controls[0][7], oldConfig().pages[1].controls[0][7])
})

test('removes the old custom variables', () => {
	const { config } = convert(oldConfig())
	assert.deepEqual(config.custom_variables, {})
})

test('does not touch its input and is deterministic', () => {
	const input = oldConfig()
	const a = convert(input)
	assert.deepEqual(input, oldConfig())
	assert.deepEqual(convert(oldConfig()).config, a.config)
})

test('fails loudly on an unknown route, unknown variable, or a config without the bridge', () => {
	const bad = oldConfig()
	bad.pages[1].controls[0][0].steps[0].action_sets.down[0].options.url = expr('http://127.0.0.1:8899/music/unknown')
	assert.throws(() => convert(bad), /unknown daemon route/)
	assert.throws(() => rewriteVariables('$(custom:nope)'), /no mapping/)
	const noBridge = oldConfig()
	delete noBridge.instances.HTTP
	assert.throws(() => convert(noBridge), /no generic-http/)
})
