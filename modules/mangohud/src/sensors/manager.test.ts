import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SensorsManager, type SensorsManagerHost } from './manager.js'
import type { SensorReadings } from './reader.js'

function makeHost(): {
	host: SensorsManagerHost
	setCalls: Record<string, string>[]
	feedbackCalls: string[][]
	logs: [string, string][]
} {
	const setCalls: Record<string, string>[] = []
	const feedbackCalls: string[][] = []
	const logs: [string, string][] = []
	const host: SensorsManagerHost = {
		setVariableValues: (values) => setCalls.push(values),
		checkFeedbacks: (...types) => feedbackCalls.push(types),
		log: (level, message) => logs.push([level, message]),
	}
	return { host, setCalls, feedbackCalls, logs }
}

test('the first poll pushes "-" for every sensor that was not found', () => {
	const { host, setCalls } = makeHost()
	const manager = new SensorsManager(host, () => ({ cpuTemp: null, gpuTemp: null, gpuLoad: null }))

	manager.configure({ sysfsRoot: '/fake', pollMs: 2000 })

	assert.deepEqual(setCalls, [{ cpu_temp: '-', gpu_temp: '-', gpu_load: '-' }])
	manager.stop()
})

test('only variables that changed since the last poll are pushed, and feedbacks only recheck for temp changes', (t) => {
	t.mock.timers.enable({ apis: ['setInterval'] })
	const { host, setCalls, feedbackCalls } = makeHost()
	let readings: SensorReadings = { cpuTemp: 40, gpuTemp: 50, gpuLoad: 10 }
	const manager = new SensorsManager(host, () => readings)

	manager.configure({ sysfsRoot: '/fake', pollMs: 1000 })
	assert.deepEqual(setCalls, [{ cpu_temp: '40', gpu_temp: '50', gpu_load: '10' }])
	assert.deepEqual(feedbackCalls, [['cpu_temp_above', 'gpu_temp_above']])

	setCalls.length = 0
	feedbackCalls.length = 0
	readings = { cpuTemp: 40, gpuTemp: 55, gpuLoad: 10 }
	t.mock.timers.tick(1000)
	assert.deepEqual(setCalls, [{ gpu_temp: '55' }])
	assert.deepEqual(feedbackCalls, [['cpu_temp_above', 'gpu_temp_above']])

	setCalls.length = 0
	feedbackCalls.length = 0
	readings = { cpuTemp: 40, gpuTemp: 55, gpuLoad: 20 }
	t.mock.timers.tick(1000)
	assert.deepEqual(setCalls, [{ gpu_load: '20' }])
	assert.deepEqual(feedbackCalls, [], 'gpu_load alone does not need a feedback recheck')

	manager.stop()
})

test('the poll interval is clamped to the 500ms minimum', (t) => {
	t.mock.timers.enable({ apis: ['setInterval'] })
	const { host } = makeHost()
	let calls = 0
	const manager = new SensorsManager(host, () => {
		calls += 1
		return { cpuTemp: null, gpuTemp: null, gpuLoad: null }
	})

	manager.configure({ sysfsRoot: '/fake', pollMs: 100 })
	assert.equal(calls, 1, 'the initial poll happens synchronously in configure()')

	t.mock.timers.tick(499)
	assert.equal(calls, 1, 'not yet at the clamped 500ms interval')

	t.mock.timers.tick(1)
	assert.equal(calls, 2)

	manager.stop()
})

test('stop() clears the timer so no further polls happen', (t) => {
	t.mock.timers.enable({ apis: ['setInterval'] })
	const { host } = makeHost()
	let calls = 0
	const manager = new SensorsManager(host, () => {
		calls += 1
		return { cpuTemp: null, gpuTemp: null, gpuLoad: null }
	})

	manager.configure({ sysfsRoot: '/fake', pollMs: 500 })
	manager.stop()
	t.mock.timers.tick(5000)

	assert.equal(calls, 1)
})

test('a read error is logged once as a warning and does not push variables or throw', () => {
	const { host, logs, setCalls } = makeHost()
	const manager = new SensorsManager(host, () => {
		throw new Error('boom')
	})

	manager.configure({ sysfsRoot: '/fake', pollMs: 2000 })

	assert.equal(setCalls.length, 0)
	assert.equal(logs.length, 1)
	assert.equal(logs[0][0], 'warn')
	manager.stop()
})

test('getCpuTemp()/getGpuTemp() reflect the latest successful poll', () => {
	const { host } = makeHost()
	const manager = new SensorsManager(host, () => ({ cpuTemp: 61, gpuTemp: 72, gpuLoad: 33 }))

	manager.configure({ sysfsRoot: '/fake', pollMs: 2000 })

	assert.equal(manager.getCpuTemp(), 61)
	assert.equal(manager.getGpuTemp(), 72)
	manager.stop()
})
