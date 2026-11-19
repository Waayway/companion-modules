import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.join(__dirname, 'fixtures', 'gamemode-service.js')

interface CheckResult {
	name: string
	pass: boolean
	detail: string
}

function hasDbusRunSession(): boolean {
	const probe = spawnSync('dbus-run-session', ['--help'])
	return !probe.error
}

test('GamemodeClient tracks ClientCount over a private D-Bus session bus (via dbus-run-session)', (t) => {
	if (!hasDbusRunSession()) {
		t.skip('dbus-run-session is not installed; skipping the gamemode D-Bus integration test')
		return
	}

	const result = spawnSync('dbus-run-session', ['--', process.execPath, FIXTURE], {
		encoding: 'utf8',
		timeout: 15_000,
	})

	const lastLine = result.stdout
		.trim()
		.split('\n')
		.filter((line) => line.length > 0)
		.pop()
	assert.ok(lastLine, `fixture produced no output on stdout; stderr: ${result.stderr}`)

	const checks = JSON.parse(lastLine) as CheckResult[]
	assert.ok(checks.length > 0, 'fixture reported zero checks')
	for (const check of checks) {
		assert.ok(check.pass, `${check.name}: ${check.detail}`)
	}

	assert.equal(result.status, 0, `fixture process exited ${result.status}; stderr: ${result.stderr}`)
})
