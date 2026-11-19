import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { FeedbackModuleContext } from './helpers.js'

export type ShuffleFeedbacksSchema = {
	shuffle_on: { type: 'boolean'; options: Record<string, never> }
}

export function ShuffleFeedbacks(self: FeedbackModuleContext): CompanionFeedbackDefinitions<ShuffleFeedbacksSchema> {
	return {
		shuffle_on: {
			type: 'boolean',
			name: 'Shuffle is on',
			defaultStyle: { bgcolor: 0x00ff00, color: 0x000000 },
			options: [],
			callback: () => self.getSnapshot().selected?.shuffle === true,
		},
	}
}
