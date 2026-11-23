#!/usr/bin/env node
// Import a .companionconfig file into a running headless Companion instance, then list its pages/
// buttons and connection statuses. See docs/notes/companion-headless.md for the full format
// finding this is built from.
//
// Usage: node tools/smoke/import-config.mjs <file.companionconfig> [companionUrl]
//   companionUrl defaults to $COMPANION_SMOKE_URL, e.g. http://127.0.0.1:44626
import crypto from 'node:crypto'
import fs from 'node:fs'

import { connectTrpc, mutate, subscribeOnce } from './lib/trpcWs.mjs'
import { makeRestClient } from './lib/rest.mjs'

const CHUNK_SIZE = 256 * 1024

function usageError(message) {
	console.error(message)
	console.error('Usage: node tools/smoke/import-config.mjs <file.companionconfig> [companionUrl]')
	process.exit(2)
}

const filePath = process.argv[2]
const companionUrl = process.argv[3] || process.env.COMPANION_SMOKE_URL
if (!filePath) usageError('Missing <file.companionconfig> argument')
if (!companionUrl) usageError('No companion URL given (pass it as arg 2, or set COMPANION_SMOKE_URL)')
if (!fs.existsSync(filePath)) usageError(`File not found: ${filePath}`)

const data = fs.readFileSync(filePath)
console.log(`Read ${data.byteLength} bytes from ${filePath}`)

const { client: trpc, close } = connectTrpc(companionUrl)
const rest = makeRestClient(companionUrl)

/** Subscribe and keep consuming values until `predicate` matches one of them, or timeout. */
async function subscribeUntil(path, input, predicate, timeoutMs = 60_000) {
	let target = trpc
	for (const segment of path.split('.')) target = target[segment]

	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			sub.unsubscribe()
			reject(new Error(`Timed out waiting for ${path} to satisfy its predicate`))
		}, timeoutMs)

		const sub = target.subscribe(input, {
			onData(value) {
				if (predicate(value)) {
					clearTimeout(timer)
					sub.unsubscribe()
					resolve(value)
				}
			},
			onError(err) {
				clearTimeout(timer)
				reject(err)
			},
		})
	})
}

try {
	// 1. Upload: start -> chunks -> complete (same ws connection throughout, since the parsed
	// import object is stashed on this connection's trpc ctx between calls - see
	// companion/lib/UI/TRPC.ts TrpcContext.pendingImport and the websocket-only trpc link in
	// webui/src/Resources/TRPC.tsx).
	const sessionId = await mutate(trpc, 'importExport.prepareImport.start', {
		name: filePath.split('/').pop(),
		size: data.byteLength,
	})
	console.log(`upload session ${sessionId}`)

	for (let offset = 0; offset < data.byteLength; offset += CHUNK_SIZE) {
		const chunk = data.subarray(offset, offset + CHUNK_SIZE)
		await mutate(trpc, 'importExport.prepareImport.uploadChunk', {
			sessionId,
			offset,
			data: chunk.toString('base64'),
		})
	}

	const expectedChecksum = crypto.createHash('sha1').update(data).digest('hex')
	// The sessionCompleteCallback in companion/lib/ImportExport/Controller.ts returns a
	// [error, ClientImportObject] tuple (see #buildClientImportObject), not the object directly.
	const [parseError, clientImportObject] = await mutate(trpc, 'importExport.prepareImport.complete', {
		sessionId,
		expectedChecksum,
		userData: null,
	})
	if (parseError) throw new Error(`Failed to parse import file: ${parseError}`)
	console.log('parsed import object:', JSON.stringify(clientImportObject, null, 2))

	if (clientImportObject.type !== 'full') {
		throw new Error(`This script only imports "full" exports, got type "${clientImportObject.type}"`)
	}

	// 2. Commit: reset-and-import everything, reset connections to the imported set.
	const importSelection = {
		buttons: 'reset-and-import',
		surfaces: { known: 'unchanged', instances: 'unchanged', remote: 'unchanged' },
		triggers: 'reset-and-import',
		customVariables: 'reset-and-import',
		expressionVariables: 'reset-and-import',
		connections: 'reset',
		userconfig: 'unchanged',
		imageLibrary: 'reset-and-import',
	}

	const { runId } = await mutate(trpc, 'importExport.importFull', { config: importSelection })
	console.log(`import running as task ${runId}`)

	await subscribeUntil(
		'importExport.importExportTaskStatus',
		undefined,
		(task) => task?.runId === runId && task.status === 'completed'
	).then((task) => {
		if (task.error) throw new Error(`Import failed: ${task.error}`)
	})
	console.log('import completed')

	// 3. List pages/buttons and connection statuses to prove the import landed.
	const pagesInit = await subscribeOnce(trpc, 'pages.watch', undefined)
	// `pages` is keyed by opaque page id, not page number; `order` maps 1-based pageNumber -> id
	// (see companion/shared-lib/lib/Model/PageModel.ts PageModelChangesInit).
	pagesInit.order.forEach((pageId, index) => {
		const page = pagesInit.pages[pageId]
		if (!page) return
		const pageNumber = index + 1
		const buttonLocations = []
		for (const [row, cols] of Object.entries(page.controls || {})) {
			for (const [column, controlId] of Object.entries(cols)) {
				if (controlId) buttonLocations.push(`${row}/${column} (${controlId})`)
			}
		}
		console.log(`page ${pageNumber} "${page.name}": ${buttonLocations.length} buttons`)
		for (const loc of buttonLocations) console.log(`  - ${loc}`)
	})

	const connections = await rest.getJson('/api/connections')
	console.log('connections after import:')
	for (const conn of connections) {
		console.log(`  - ${conn.label} (${conn.moduleId}, ${conn.id}): ${JSON.stringify(conn.status)}`)
	}
} finally {
	close()
}
