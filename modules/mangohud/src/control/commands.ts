export const HUD_COMMAND = ':hud;'
export const FCAT_COMMAND = ':fcat;'

export function loggingCommand(state?: 0 | 1): string {
	return state === undefined ? ':logging;' : `:logging=${state};`
}
