import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PresetManager, type PresetManagerHost } from './manager.js'

function makeFakeHost(): PresetManagerHost & {
	variables: Record<string, string>
	checked: string[][]
	logs: string[]
} {
	const variables: Record<string, string> = {}
	const checked: string[][] = []
	const logs: string[] = []
	return {
		variables,
		checked,
		logs,
		setVariableValues(values) {
			for (const [key, value] of Object.entries(values)) {
				if (value !== undefined) variables[key] = value
			}
		},
		checkFeedbacks(...feedbackTypes) {
			checked.push(feedbackTypes)
		},
		log(level, message) {
			logs.push(`${level}: ${message}`)
		},
	}
}

function makeTempDir(t: import('node:test').TestContext): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mangohud-manager-test-'))
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
	return dir
}

test('PresetManager reports preset "?" when the config dir is missing', (t) => {
	const host = makeFakeHost()
	const manager = new PresetManager(host)
	t.after(() => manager.stop())

	manager.configure({
		configDir: path.join(os.tmpdir(), 'mangohud-manager-missing-' + process.pid),
		cycleOrder: '1,2,0',
		presetLabels: '0=Off,1=Bar,2=Detail',
		updatePerAppConfigs: true,
	})

	assert.equal(host.variables.preset, '?')
	assert.equal(host.variables.preset_name, '?')
})

test('PresetManager.setPreset writes the file and updates variables/feedbacks immediately', (t) => {
	const dir = makeTempDir(t)
	fs.writeFileSync(path.join(dir, 'MangoHud.conf'), 'preset=0,1,2\n')
	const host = makeFakeHost()
	const manager = new PresetManager(host)
	t.after(() => manager.stop())

	manager.configure({
		configDir: dir,
		cycleOrder: '1,2,0',
		presetLabels: '0=Off,1=Bar,2=Detail',
		updatePerAppConfigs: false,
	})
	manager.setPreset(2)

	assert.equal(fs.readFileSync(path.join(dir, 'MangoHud.conf'), 'utf8'), 'preset=2,1,0\n')
	assert.equal(host.variables.preset, '2')
	assert.equal(host.variables.preset_name, 'Detail')
	assert.ok(host.checked.some((ids) => ids.includes('preset_is')))
})

test('PresetManager.cyclePreset advances through the configured cycle order', (t) => {
	const dir = makeTempDir(t)
	fs.writeFileSync(path.join(dir, 'MangoHud.conf'), 'preset=1,2,0\n')
	const host = makeFakeHost()
	const manager = new PresetManager(host)
	t.after(() => manager.stop())

	manager.configure({
		configDir: dir,
		cycleOrder: '1,2,0',
		presetLabels: '0=Off,1=Bar,2=Detail',
		updatePerAppConfigs: false,
	})
	assert.equal(host.variables.preset, '1')

	manager.cyclePreset()
	assert.equal(host.variables.preset, '2')

	manager.cyclePreset()
	assert.equal(host.variables.preset, '0')
})

test('PresetManager.refresh() picks up an external edit to MangoHud.conf', (t) => {
	const dir = makeTempDir(t)
	fs.writeFileSync(path.join(dir, 'MangoHud.conf'), 'preset=0,1,2\n')
	const host = makeFakeHost()
	const manager = new PresetManager(host)
	t.after(() => manager.stop())

	manager.configure({
		configDir: dir,
		cycleOrder: '1,2,0',
		presetLabels: '0=Off,1=Bar,2=Detail',
		updatePerAppConfigs: false,
	})
	assert.equal(host.variables.preset, '0')

	fs.writeFileSync(path.join(dir, 'MangoHud.conf'), 'preset=2,0,1\n')
	manager.refresh()

	assert.equal(host.variables.preset, '2')
	assert.equal(host.variables.preset_name, 'Detail')
})
