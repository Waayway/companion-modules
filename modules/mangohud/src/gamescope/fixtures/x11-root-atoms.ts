import x11 from 'x11'
import type { XClient, XDisplay } from 'x11'
import { readRootAtoms } from '../atoms.js'

interface CheckResult {
	name: string
	pass: boolean
	detail: string
}

async function connect(display: string): Promise<XDisplay> {
	return new Promise((resolve, reject) => {
		x11.createClient({ display }, (err, xdisplay) => (err ? reject(err) : resolve(xdisplay)))
	})
}

async function internAtom(client: XClient, name: string): Promise<number> {
	return new Promise((resolve, reject) =>
		client.InternAtom(false, name, (err, atom) => (err ? reject(err) : resolve(atom))),
	)
}

async function main(): Promise<void> {
	const results: CheckResult[] = []
	const record = (name: string, pass: boolean, detail = ''): void => {
		results.push({ name, pass, detail })
	}

	const display = process.argv[2]
	if (!display) {
		record('fixture received a display argument', false, 'usage: x11-root-atoms.js <display>')
		finish(results)
		return
	}

	try {
		const xdisplay = await connect(display)
		const client = xdisplay.client
		const root = xdisplay.screen[0].root

		const cardinalAtom = await internAtom(client, 'CARDINAL')
		const hdrAtom = await internAtom(client, 'GAMESCOPE_HDR_OUTPUT_FEEDBACK')
		const vrrAtom = await internAtom(client, 'GAMESCOPE_VRR_FEEDBACK')
		client.ChangeProperty(0, root, hdrAtom, cardinalAtom, 32, [1])
		client.ChangeProperty(0, root, vrrAtom, cardinalAtom, 32, [0, 42])
		await client.sync() // round trip: both ChangeProperty requests are applied before the next line

		// readRootAtoms opens its own connection; keep this one open while it does so Xvfb never sees
		// a disconnect-then-immediately-reconnect (observed to race with its per-client XKB setup and
		// get the new connection dropped with "closed before setup completed")
		const atoms = await readRootAtoms(display)
		client.terminate()
		record(
			'readRootAtoms decodes GAMESCOPE_HDR_OUTPUT_FEEDBACK as [1]',
			JSON.stringify(atoms.GAMESCOPE_HDR_OUTPUT_FEEDBACK) === JSON.stringify([1]),
			JSON.stringify(atoms),
		)
		record(
			'readRootAtoms decodes GAMESCOPE_VRR_FEEDBACK as [0, 42]',
			JSON.stringify(atoms.GAMESCOPE_VRR_FEEDBACK) === JSON.stringify([0, 42]),
			JSON.stringify(atoms),
		)
	} catch (err) {
		record('fixture crashed', false, err instanceof Error ? (err.stack ?? err.message) : String(err))
	}

	finish(results)
}

function finish(results: CheckResult[]): void {
	console.log(JSON.stringify(results))
	process.exitCode = results.every((r) => r.pass) ? 0 : 1
}

main().catch((err: unknown) => {
	finish([
		{ name: 'fixture crashed', pass: false, detail: err instanceof Error ? (err.stack ?? err.message) : String(err) },
	])
})
