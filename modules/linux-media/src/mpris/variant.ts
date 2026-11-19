/** Unwraps a `@particle/dbus-next` Variant down to its plain value, tolerating already-unwrapped input. */
export function unwrapVariant(value: unknown): unknown {
	if (typeof value === 'object' && value !== null && 'signature' in value && 'value' in value) {
		return (value as { value: unknown }).value
	}
	return value
}
