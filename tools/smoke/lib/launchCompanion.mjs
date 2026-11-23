import { spawn } from 'node:child_process'
import readline from 'node:readline'

const READY_MARKER = 'COMPANION_READY '

/**
 * Launch a real headless Companion (via tools/smoke/launch.mts in the companion clone, which
 * reuses the project's own e2e-test fixture) as a child process, resolving once its http server
 * is listening. Mirrors companion/e2e/support/companion.ts.
 */
export async function launchCompanion({ companionRepo, configDir, modulesPath, env = {} }) {
	const child = spawn(
		process.execPath,
		['--conditions=companion:source', '--import', 'tsx', 'tools/smoke/launch.mts'],
		{
			cwd: companionRepo,
			env: {
				...process.env,
				...env,
				COMPANION_SMOKE_CONFIG_DIR: configDir,
				COMPANION_SMOKE_MODULES_PATH: modulesPath,
			},
			stdio: ['ignore', 'pipe', 'pipe'],
		}
	)

	const logLines = []
	let settled = false
	const ready = await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			if (settled) return
			settled = true
			reject(new Error('Timed out waiting for Companion to start'))
		}, 90_000)

		const onLine = (line) => {
			logLines.push(line)
			console.log(`[companion] ${line}`)
			if (!settled && line.startsWith(READY_MARKER)) {
				settled = true
				clearTimeout(timeout)
				resolve(JSON.parse(line.slice(READY_MARKER.length)))
			}
		}
		readline.createInterface({ input: child.stdout }).on('line', onLine)
		readline.createInterface({ input: child.stderr }).on('line', onLine)

		child.on('exit', (code, signal) => {
			if (settled) return
			settled = true
			clearTimeout(timeout)
			reject(new Error(`Companion exited before becoming ready (code ${code}, signal ${signal})`))
		})
		child.on('error', (err) => {
			if (settled) return
			settled = true
			clearTimeout(timeout)
			reject(err)
		})
	})

	return {
		url: `http://127.0.0.1:${ready.port}`,
		port: ready.port,
		configDir: ready.configDir,
		child,
		logLines,

		async stop() {
			if (child.exitCode !== null || child.signalCode !== null) return
			const exited = new Promise((resolve) => child.once('exit', resolve))
			child.kill('SIGTERM')
			const killTimeout = setTimeout(() => child.kill('SIGKILL'), 15_000)
			await exited
			clearTimeout(killTimeout)
		},
	}
}
