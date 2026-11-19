import type ModuleInstance from '../main.js'
import { PlaybackFeedbacks, type PlaybackFeedbacksSchema } from './playback.js'
import { ShuffleFeedbacks, type ShuffleFeedbacksSchema } from './shuffle.js'
import { LoopFeedbacks, type LoopFeedbacksSchema } from './loop.js'
import { PlayerFeedbacks, type PlayerFeedbacksSchema } from './player.js'

export type FeedbacksSchema = PlaybackFeedbacksSchema &
	ShuffleFeedbacksSchema &
	LoopFeedbacksSchema &
	PlayerFeedbacksSchema

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		...PlaybackFeedbacks(self),
		...ShuffleFeedbacks(self),
		...LoopFeedbacks(self),
		...PlayerFeedbacks(self),
	})
}
