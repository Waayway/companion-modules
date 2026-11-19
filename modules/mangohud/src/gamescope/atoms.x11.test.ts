import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.join(__dirname, 'fixtures', 'x11-root-atoms.js')

interface CheckResult {
	name: string
	pass: boolean
	detail: string
}

/** Checks PATH first, then falls back to `nix shell nixpkgs#xorg-server` (per the slice-3 brief). */
function resolveXvfbPath(): string | null {
	const direct = spawnSync('sh', ['-c', 'command -v Xvfb'], { encoding: 'utf8' })
	if (direct.status === 0 && direct.stdout.trim()) return direct.stdout.trim()

	const viaNix = spawnSync('nix', ['shell', 'nixpkgs#xorg-server', '-c', 'which', 'Xvfb'], {
		encoding: 'utf8',
		timeout: 60_000,
	})
	if (!viaNix.error && viaNix.status === 0 && viaNix.stdout.trim()) return viaNix.stdout.trim()

	return null
}

function freeDisplayNumber(): number {
	for (let candidate = 90; candidate < 200; candidate++) {
		if (!fs.existsSync(`/tmp/.X11-unix/X${candidate}`)) return candidate
	}
	throw new Error('no free X11 display number found under /tmp/.X11-unix')
}

async function waitForSocket(displayNum: number, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		if (fs.existsSync(`/tmp/.X11-unix/X${displayNum}`)) return
		await new Promise((resolve) => setTimeout(resolve, 50))
	}
	throw new Error(`Xvfb did not create /tmp/.X11-unix/X${displayNum} within ${timeoutMs}ms`)
}

test('readRootAtoms decodes real GAMESCOPE_*_FEEDBACK properties from a live Xvfb root window', async (t) => {
	const xvfbPath = resolveXvfbPath()
	if (!xvfbPath) {
		t.skip(
			'no Xvfb binary available (checked PATH and `nix shell nixpkgs#xorg-server`); skipping the real X11 integration test',
		)
		return
	}

	const displayNum = freeDisplayNumber()
	const display = `:${displayNum}`
	const xvfb = spawn(xvfbPath, [display, '-screen', '0', '64x64x8'], { stdio: 'ignore' })
	let xvfbExited = false
	xvfb.once('exit', () => {
		xvfbExited = true
	})
	t.after(() => {
		if (!xvfbExited) xvfb.kill('SIGTERM')
	})

	await waitForSocket(displayNum, 5000)
	// the socket inode can exist slightly before Xvfb actually accepts connections
	await new Promise((resolve) => setTimeout(resolve, 300))

	const result = spawnSync(
		process.execPath,
		['--permission', '--allow-net', '--allow-fs-read=*', '--allow-fs-write=*', FIXTURE, display],
		{ encoding: 'utf8', timeout: 15_000 },
	)

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
