/** Formats any thrown value as a log-friendly message. */
export function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err)
}
