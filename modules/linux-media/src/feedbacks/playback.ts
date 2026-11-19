import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { FeedbackModuleContext } from './helpers.js'

export type PlaybackFeedbacksSchema = {
	playing: { type: 'boolean'; options: Record<string, never> }
	paused: { type: 'boolean'; options: Record<string, never> }
	stopped: { type: 'boolean'; options: Record<string, never> }
}

export function PlaybackFeedbacks(self: FeedbackModuleContext): CompanionFeedbackDefinitions<PlaybackFeedbacksSchema> {
	return {
		playing: {
			type: 'boolean',
			name: 'Playing',
			defaultStyle: { bgcolor: 0x00ff00, color: 0x000000 },
			options: [],
			callback: () => self.getSnapshot().selected?.playbackStatus === 'Playing',
		},
		paused: {
			type: 'boolean',
			name: 'Paused',
			defaultStyle: { bgcolor: 0xffff00, color: 0x000000 },
			options: [],
			callback: () => self.getSnapshot().selected?.playbackStatus === 'Paused',
		},
		stopped: {
			type: 'boolean',
			name: 'Stopped',
			defaultStyle: { bgcolor: 0xff0000, color: 0x000000 },
			options: [],
			callback: () => (self.getSnapshot().selected?.playbackStatus ?? 'Stopped') === 'Stopped',
		},
	}
}
