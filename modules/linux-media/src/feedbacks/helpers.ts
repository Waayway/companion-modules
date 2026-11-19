import type { TrackerSnapshot } from '../mpris/tracker.js'

/**
 * The surface of `ModuleInstance` the feedback definitions depend on. Kept as a narrow interface (rather
 * than importing the concrete class) so tests can exercise feedbacks against a plain snapshot holder.
 */
export interface FeedbackModuleContext {
	getSnapshot(): TrackerSnapshot
}
