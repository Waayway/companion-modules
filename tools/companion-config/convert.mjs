// Converts a Companion config that drives the old "Generic HTTP + mangocompanion.py" setup to the native
// linux-media and mangohud modules. Pure data transform, no dependencies.
//
//   node tools/companion-config/convert.mjs <old.companionconfig> <new.companionconfig>
//
// What it does (every change is listed in the printed report):
//  - replaces the generic-http "bridge" connection by two connections, `media` (linux-media) and
//    `mangohud` (mangohud);
//  - rewrites the HTTP "get" actions to the module actions, `$(custom:...)` variables to
//    `$(media:...)` / `$(mangohud:...)`, and the variable_value feedbacks that read them;
//  - removes the custom variables (nothing reads them any more);
//  - removes buttons that need system audio (system volume / mute / mic mute): dropped on purpose;
//  - scrubs credentials of other connections (Discord client secret and tokens): their buttons stay,
//    the connection stays enabled with an empty config you fill in again;
//  - leaves pages, navigation, surfaces, images and every other button untouched.
import crypto from 'node:crypto'
import fs from 'node:fs'
import zlib from 'node:zlib'

/** How a connection to a module that is loaded from a developer folder is stored. */
export const MODULE_ENTRY = {
	moduleVersionId: 'dev',
	updatePolicy: 'stable',
	lastUpgradeIndex: -1,
	upgradeIndex: -1,
}

const MEDIA_VARS = ['status', 'player', 'artist', 'title', 'volume', 'shuffle', 'loop']
export const VARIABLE_MAP = {
	mp_status: ['media', 'status'],
	mp_player: ['media', 'player'],
	mp_artist: ['media', 'artist'],
	mp_title: ['media', 'title'],
	mp_volume: ['media', 'volume'],
	mp_shuffle: ['media', 'shuffle'],
	mp_loop: ['media', 'loop'],
	mh_preset: ['mangohud', 'preset'],
	mh_preset_name: ['mangohud', 'preset_name'],
	gs_running: ['mangohud', 'gs_running'],
	gs_hdr: ['mangohud', 'gs_hdr'],
	gs_vrr: ['mangohud', 'gs_vrr'],
	gs_wsi: ['mangohud', 'gs_wsi'],
	gs_mode: ['mangohud', 'gs_mode'],
	gamemode: ['mangohud', 'gamemode'],
	cpu_temp: ['mangohud', 'cpu_temp'],
	gpu_temp: ['mangohud', 'gpu_temp'],
	gpu_load: ['mangohud', 'gpu_load'],
}
void MEDIA_VARS

/** Variables that only the dropped system-audio feature provided. */
export const DROPPED_VARIABLES = ['sys_volume', 'sys_mute', 'mic_mute']

/** HTTP path of the old daemon -> [connection key, action id, options]. null = dropped (system audio). */
export const ACTION_MAP = {
	'/music/play-pause': ['media', 'playpause', {}],
	'/music/next': ['media', 'next', {}],
	'/music/previous': ['media', 'previous', {}],
	'/music/shuffle': ['media', 'shuffle', { mode: 'toggle' }],
	'/music/loop': ['media', 'loop', { mode: 'cycle' }],
	'/music/vol-up': ['media', 'volume_up', { step: 5 }],
	'/music/vol-down': ['media', 'volume_down', { step: 5 }],
	'/preset/cycle': ['mangohud', 'cycle_preset', {}],
	'/music/sys-mute': null,
	'/music/mic-mute': null,
	'/music/sys-vol-up': null,
	'/music/sys-vol-down': null,
}

const expr = (value) => ({ isExpression: false, value })

export function stableId(seed) {
	return crypto.createHash('sha256').update(`companion-modules:${seed}`).digest('base64url').slice(0, 21)
}

function mapActionPath(path) {
	if (path in ACTION_MAP) return ACTION_MAP[path]
	const preset = /^\/preset\/(-?\d+)$/.exec(path)
	if (preset) return ['mangohud', 'set_preset', { preset: Number(preset[1]) }]
	throw new Error(`unknown daemon route ${path}`)
}

function* walkStrings(node, set) {
	// yields [object, key] for every string value so callers can rewrite in place
	if (Array.isArray(node)) {
		for (let i = 0; i < node.length; i++) {
			if (typeof node[i] === 'string') yield [node, i]
			else yield* walkStrings(node[i], set)
		}
	} else if (node && typeof node === 'object') {
		for (const key of Object.keys(node)) {
			if (typeof node[key] === 'string') yield [node, key]
			else yield* walkStrings(node[key], set)
		}
	}
}

/** Rewrites `$(custom:name)` and `custom:name` references. Throws on an unknown variable. */
export function rewriteVariables(text) {
	const known = (name) => {
		const hit = VARIABLE_MAP[name]
		if (!hit) throw new Error(`no mapping for custom variable "${name}"`)
		return `${hit[0]}:${hit[1]}`
	}
	if (/^custom:[\w.!-]+$/.test(text)) return known(text.slice('custom:'.length))
	return text.replace(/\$\(custom:([\w.!-]+)\)/g, (_m, name) => `$(${known(name)})`)
}

function usesDroppedVariable(text) {
	return DROPPED_VARIABLES.some((v) => text.includes(`custom:${v}`))
}

export function convert(old) {
	const config = structuredClone(old)
	const report = { removedButtons: [], rewrittenActions: 0, rewrittenFeedbacks: 0, droppedFeedbacks: 0, scrubbed: [] }

	const instances = config.instances
	const bridgeId = Object.keys(instances).find((id) => instances[id].moduleId === 'generic-http')
	if (!bridgeId) throw new Error('no generic-http connection found: is this the old HTTP-bridge config?')
	const ids = { media: stableId('media'), mangohud: stableId('mangohud') }

	delete instances[bridgeId]
	instances[ids.media] = connection('linux-media', 'media', 0, { player: 'auto', busAddress: '' })
	instances[ids.mangohud] = connection('mangohud', 'mangohud', 1, {
		configDir: '',
		controlSocket: 'mangohud',
		cycleOrder: '1,2,0',
		presetLabels: '0=Off, 1=Bar, 2=Detail',
		updatePerAppConfigs: true,
		sensorPollMs: 2000,
	})

	// Credentials of other connections never leave the machine in a committed file.
	for (const [id, inst] of Object.entries(instances)) {
		if (id === ids.media || id === ids.mangohud) continue
		if (inst.config && Object.keys(inst.config).length > 0) {
			report.scrubbed.push(`${inst.label} (${inst.moduleId}): config fields ${Object.keys(inst.config).join(', ')}`)
			inst.config = {}
		}
		inst.secrets = {}
	}

	config.custom_variables = {}
	config.customVariablesCollections = []

	for (const [pageNo, page] of Object.entries(config.pages)) {
		for (const [row, cols] of Object.entries(page.controls)) {
			for (const [col, control] of Object.entries(cols)) {
				if (control.type !== 'button-layered' && control.type !== 'button') continue
				const where = `page ${pageNo} "${page.name}" [${row},${col}]`
				const label = buttonLabel(control)
				if (buttonNeedsDroppedFeature(control, bridgeId)) {
					delete cols[col]
					report.removedButtons.push(`${where} ${label}`)
					continue
				}
				// Actions
				for (const step of Object.values(control.steps ?? {})) {
					for (const set of Object.values(step.action_sets ?? {})) {
						if (!Array.isArray(set)) continue
						for (const action of set) {
							if (action.connectionId !== bridgeId) continue
							const url = action.options?.url?.value ?? ''
							const path = url.replace(/^https?:\/\/[^/]+/, '')
							const [conn, definitionId, options] = mapActionPath(path)
							action.connectionId = ids[conn]
							action.definitionId = definitionId
							action.options = Object.fromEntries(Object.entries(options).map(([k, v]) => [k, expr(v)]))
							action.upgradeIndex = MODULE_ENTRY.upgradeIndex
							report.rewrittenActions++
						}
					}
				}
				// Feedbacks that read a daemon variable which no longer has a counterpart
				if (Array.isArray(control.feedbacks)) {
					control.feedbacks = control.feedbacks.filter((fb) => {
						const v = fb.options?.variable?.value
						const target = fb.options?.value?.value
						// the daemon never reported gamemode "req"; the module only has on/off
						if (v === 'custom:gamemode' && target === 'req') {
							report.droppedFeedbacks++
							return false
						}
						return true
					})
				}
				// Text, variable references in feedbacks and style overrides
				for (const [obj, key] of walkStrings(control, null)) {
					const next = rewriteVariables(obj[key])
					if (next !== obj[key]) {
						obj[key] = next
						if (key === 'value' || typeof key === 'string') report.rewrittenFeedbacks++
					}
				}
			}
		}
	}
	return { config, report }
}

function connection(moduleId, label, sortOrder, cfg) {
	return {
		moduleInstanceType: 'connection',
		moduleId,
		moduleVersionId: MODULE_ENTRY.moduleVersionId,
		updatePolicy: MODULE_ENTRY.updatePolicy,
		sortOrder,
		label,
		isFirstInit: false,
		config: cfg,
		secrets: {},
		lastUpgradeIndex: MODULE_ENTRY.lastUpgradeIndex,
		enabled: true,
	}
}

function buttonLabel(control) {
	const text = (control.style?.layers ?? []).find((l) => l.type === 'text')?.text?.value
	return text ? JSON.stringify(text) : ''
}

function buttonNeedsDroppedFeature(control, bridgeId) {
	for (const step of Object.values(control.steps ?? {})) {
		for (const set of Object.values(step.action_sets ?? {})) {
			if (!Array.isArray(set)) continue
			for (const action of set) {
				if (action.connectionId !== bridgeId) continue
				const path = (action.options?.url?.value ?? '').replace(/^https?:\/\/[^/]+/, '')
				if (path in ACTION_MAP && ACTION_MAP[path] === null) return true
			}
		}
	}
	for (const [obj, key] of walkStrings(control, null)) if (usesDroppedVariable(obj[key])) return true
	return false
}

export function readConfig(file) {
	const raw = fs.readFileSync(file)
	const text = raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8')
	return JSON.parse(text)
}

export function writeConfig(file, config) {
	fs.writeFileSync(file, zlib.gzipSync(Buffer.from(JSON.stringify(config)), { level: 9 }))
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const [input, output] = process.argv.slice(2)
	if (!input || !output) {
		console.error('usage: convert.mjs <old.companionconfig> <new.companionconfig>')
		process.exit(2)
	}
	const { config, report } = convert(readConfig(input))
	writeConfig(output, config)
	console.log(`wrote ${output}`)
	console.log(`actions rewritten: ${report.rewrittenActions}`)
	console.log(`variable references rewritten: ${report.rewrittenFeedbacks}`)
	console.log(`feedbacks dropped (never reported by the new module): ${report.droppedFeedbacks}`)
	console.log(`buttons removed (system audio is not supported): ${report.removedButtons.length}`)
	for (const b of report.removedButtons) console.log(`  - ${b}`)
	console.log(`credentials scrubbed: ${report.scrubbed.length}`)
	for (const s of report.scrubbed) console.log(`  - ${s}`)
}
