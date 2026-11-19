import fs from 'node:fs'

/**
 * Debounced fs.watch on the config dir (editors and MangoHud itself rename-replace files).
 * A missing directory is not an error: watching is simply skipped, and the returned closer is a no-op.
 */
export function watchConfigDir(dir: string, onChange: () => void, debounceMs = 100): () => void {
	let timer: NodeJS.Timeout | null = null
	let watcher: fs.FSWatcher | null = null

	const trigger = (): void => {
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			timer = null
			onChange()
		}, debounceMs)
	}

	try {
		watcher = fs.watch(dir, { persistent: false }, () => trigger())
	} catch {
		watcher = null
	}

	return () => {
		if (timer) clearTimeout(timer)
		timer = null
		watcher?.close()
		watcher = null
	}
}
