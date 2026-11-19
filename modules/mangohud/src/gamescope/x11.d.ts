/** `x11` ships no types; this declares only the surface this module and its test fixtures call. */
declare module 'x11' {
	export interface XProperty {
		type: number
		format: number
		bytesAfter: number
		data: Buffer
	}

	export interface XScreen {
		root: number
	}

	export interface XClient {
		ListProperties(wid: number, cb: (err: Error | null, atoms: number[]) => void): void
		GetAtomName(atom: number, cb: (err: Error | null, name: string) => void): void
		GetProperty(
			del: number,
			wid: number,
			name: number,
			type: number,
			longOffset: number,
			longLength: number,
			cb: (err: Error | null, prop: XProperty) => void,
		): void
		// test-fixture only: used to set up fake gamescope properties on a real Xvfb root window
		InternAtom(onlyIfExists: boolean, name: string, cb: (err: Error | null, atom: number) => void): void
		ChangeProperty(mode: number, wid: number, name: number, type: number, format: number, data: number[]): void
		sync(): Promise<void>
		terminate(): void
	}

	export interface XDisplay {
		client: XClient
		screen: XScreen[]
	}

	export function createClient(
		options: { display?: string },
		cb: (err: Error | null, display: XDisplay) => void,
	): XClient
}
