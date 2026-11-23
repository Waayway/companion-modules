import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'

/**
 * Companion's trpc router is only reachable over the websocket link (see
 * webui/src/Resources/TRPC.tsx - httpBatchLink is commented out there), because some procedures
 * (prepareImport.*, importExport.importFull) stash state on the per-connection `ctx` object
 * between calls. A fresh ctx per HTTP request would lose that state, so this must be one
 * persistent websocket for the lifetime of a session.
 */
export function connectTrpc(httpUrl) {
	const url = httpUrl.replace(/^http/, 'ws') + '/trpc'
	const wsClient = createWSClient({ url })
	const client = createTRPCClient({ links: [wsLink({ client: wsClient })] })
	return { client, wsClient, url, close: () => wsClient.close() }
}

function resolvePath(client, dottedPath) {
	let target = client
	for (const segment of dottedPath.split('.')) target = target[segment]
	return target
}

export async function mutate(client, dottedPath, input) {
	return resolvePath(client, dottedPath).mutate(input)
}

export async function query(client, dottedPath, input) {
	return resolvePath(client, dottedPath).query(input)
}

/** Subscribe, resolve with the first emitted value, then unsubscribe. */
export async function subscribeOnce(client, dottedPath, input) {
	return new Promise((resolve, reject) => {
		const sub = resolvePath(client, dottedPath).subscribe(input, {
			onData(data) {
				sub.unsubscribe()
				resolve(data)
			},
			onError(err) {
				reject(err)
			},
		})
	})
}
