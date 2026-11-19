import x11 from 'x11'
import type { XClient, XDisplay } from 'x11'

const FEEDBACK_ATOM_NAME = /FEEDBACK/
const CARDINAL_FORMAT = 32

export type CreateClientFn = (
	options: { display: string },
	cb: (err: Error | null, display: XDisplay) => void,
) => XClient

async function connect(createClientFn: CreateClientFn, display: string, timeoutMs: number): Promise<XDisplay> {
	return new Promise((resolve, reject) => {
		let settled = false
		const timer = setTimeout(() => {
			if (settled) return
			settled = true
			reject(new Error(`X11 connection to ${display} timed out after ${timeoutMs}ms`))
		}, timeoutMs)

		createClientFn({ display }, (err, xdisplay) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			if (err) reject(err)
			else resolve(xdisplay)
		})
	})
}

async function listProperties(client: XClient, wid: number): Promise<number[]> {
	return new Promise((resolve, reject) =>
		client.ListProperties(wid, (err, atoms) => (err ? reject(err) : resolve(atoms))),
	)
}

async function getAtomName(client: XClient, atom: number): Promise<string> {
	return new Promise((resolve, reject) => client.GetAtomName(atom, (err, name) => (err ? reject(err) : resolve(name))))
}

async function getProperty(client: XClient, wid: number, atom: number): Promise<{ format: number; data: Buffer }> {
	return new Promise((resolve, reject) =>
		// type 0 = AnyPropertyType, longLength 32 is ample for a one-or-two-CARDINAL feedback atom
		client.GetProperty(0, wid, atom, 0, 0, 32, (err, prop) => (err ? reject(err) : resolve(prop))),
	)
}

function decodeCardinals(data: Buffer): number[] {
	const values: number[] = []
	for (let offset = 0; offset + 4 <= data.length; offset += 4) values.push(data.readUInt32LE(offset))
	return values
}

/**
 * Root-window properties on `display` whose atom name contains "FEEDBACK" (gamescope's
 * GAMESCOPE_HDR_OUTPUT_FEEDBACK / GAMESCOPE_VRR_FEEDBACK), decoded as CARDINAL arrays. The
 * connection is made and torn down per call; nothing is kept open between polls.
 */
export async function readRootAtoms(
	display: string,
	timeoutMs = 1000,
	createClientFn: CreateClientFn = x11.createClient,
): Promise<Record<string, number[]>> {
	const xdisplay = await connect(createClientFn, display, timeoutMs)
	const client = xdisplay.client
	try {
		const root = xdisplay.screen[0].root
		const atomIds = await listProperties(client, root)

		const result: Record<string, number[]> = {}
		for (const atomId of atomIds) {
			const name = await getAtomName(client, atomId).catch(() => null)
			if (!name || !FEEDBACK_ATOM_NAME.test(name)) continue

			const prop = await getProperty(client, root, atomId).catch(() => null)
			if (prop && prop.format === CARDINAL_FORMAT) result[name] = decodeCardinals(prop.data)
		}
		return result
	} finally {
		client.terminate()
	}
}
