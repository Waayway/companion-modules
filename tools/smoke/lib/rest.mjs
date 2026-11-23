/** Thin wrapper around Companion's legacy (unauthenticated, `http_api_enabled`-gated) REST API at /api/. */
export function makeRestClient(baseUrl) {
	async function raw(method, path, body) {
		const res = await fetch(`${baseUrl}${path}`, {
			method,
			headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
			body: body !== undefined ? JSON.stringify(body) : undefined,
		})
		return res
	}

	return {
		async getJson(path) {
			const res = await raw('GET', path)
			if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`)
			return res.json()
		},
		/** Returns {status, text} instead of throwing - for routes whose plain-text body matters. */
		async getText(path) {
			const res = await raw('GET', path)
			return { status: res.status, text: await res.text() }
		},
		async post(path, body) {
			const res = await raw('POST', path, body)
			return { status: res.status, text: await res.text() }
		},
	}
}
