import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import { LOOP_STATUS_CYCLE } from '../mpris/loop.js'
import type { FeedbackModuleContext } from './helpers.js'

export type LoopFeedbacksSchema = {
	loop_mode_is: { type: 'boolean'; options: { mode: 'None' | 'Playlist' | 'Track' } }
}

export function LoopFeedbacks(self: FeedbackModuleContext): CompanionFeedbackDefinitions<LoopFeedbacksSchema> {
	return {
		loop_mode_is: {
			type: 'boolean',
			name: 'Loop mode is',
			defaultStyle: { bgcolor: 0x0000ff, color: 0xffffff },
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					default: 'Playlist',
					choices: LOOP_STATUS_CYCLE.map((mode) => ({ id: mode, label: mode })),
				},
			],
			callback: (feedback) => (self.getSnapshot().selected?.loopStatus ?? 'None') === feedback.options.mode,
		},
	}
}
