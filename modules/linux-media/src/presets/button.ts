import type { ModuleSchema } from '../main.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsShowStatusIcons,
	type CompanionButtonStepActions,
	type CompanionPresetAlternatives,
	type CompanionPresetFeedbackStyleOverride,
	type SomePresetLayeredFeedbackEntry,
	type SomePresetSimpleFeedbackEntry,
} from '@companion-module/base'
import { IDLE_BG, IDLE_LABEL } from './colors.js'

/** A feedback-driven style change, shared between the layered and simple variants of a button preset. */
export interface ButtonFeedbackState {
	feedbackId: string
	options: Record<string, unknown>
	isInverted?: boolean
	boxColor?: number
	textColor?: number
	text?: string
}

export interface ButtonSpec {
	name: string
	/** Plain label text, usable as-is for the simple fallback (may contain `$(connection:variable)`). */
	text: string
	/** Expression for the layered text element, when `text` needs variable substitution or concatenation. */
	expression?: string
	/** Percentage of element height, 3-200. Defaults to 80 (short static labels use this). */
	fontsize?: number
	steps: CompanionButtonStepActions<ModuleSchema>[]
	states?: ButtonFeedbackState[]
}

/**
 * Builds a button preset as `type: 'alternatives'`: a rich layered variant (box0 background +
 * text0 label, matching the owner's original buttons minus their icon library) with a simple-style
 * fallback for hosts that can't render layered presets, as the docs recommend for Buttons compatibility.
 */
export function buttonPreset(spec: ButtonSpec): CompanionPresetAlternatives<ModuleSchema> {
	const fontsize = spec.fontsize ?? 80
	const states = spec.states ?? []
	const layeredText = spec.expression !== undefined ? { isExpression: true as const, value: spec.expression } : spec.text

	const layeredFeedbacks: SomePresetLayeredFeedbackEntry<ModuleSchema>[] = states.map((state) => {
		const styleOverrides: CompanionPresetFeedbackStyleOverride[] = []
		if (state.boxColor !== undefined) {
			styleOverrides.push({ elementId: 'box0', elementProperty: 'color', override: state.boxColor })
		}
		if (state.textColor !== undefined) {
			styleOverrides.push({ elementId: 'text0', elementProperty: 'color', override: state.textColor })
		}
		if (state.text !== undefined) {
			styleOverrides.push({ elementId: 'text0', elementProperty: 'text', override: state.text })
		}
		return {
			feedbackId: state.feedbackId,
			options: state.options,
			isInverted: state.isInverted,
			styleOverrides,
		} as unknown as SomePresetLayeredFeedbackEntry<ModuleSchema>
	})

	const simpleFeedbacks: SomePresetSimpleFeedbackEntry<ModuleSchema>[] = states.map(
		(state) =>
			({
				feedbackId: state.feedbackId,
				options: state.options,
				isInverted: state.isInverted,
				style: {
					...(state.boxColor !== undefined ? { bgcolor: state.boxColor } : {}),
					...(state.textColor !== undefined ? { color: state.textColor } : {}),
					...(state.text !== undefined ? { text: state.text } : {}),
				},
			}) as unknown as SomePresetSimpleFeedbackEntry<ModuleSchema>,
	)

	return {
		type: 'alternatives',
		variants: [
			{
				type: 'layered',
				name: spec.name,
				canvas: {
					decoration: ButtonGraphicsDecorationType.TopBar,
					showStatusIcons: ButtonGraphicsShowStatusIcons.FollowDefault,
				},
				elements: [
					{
						type: 'box',
						id: 'box0',
						name: 'Background',
						x: 0,
						y: 0,
						width: 100,
						height: 100,
						color: IDLE_BG,
					},
					{
						type: 'text',
						id: 'text0',
						name: 'Label',
						x: 0,
						y: 0,
						width: 100,
						height: 100,
						text: layeredText,
						color: IDLE_LABEL,
						font: 'companion-sans',
						weight: 'bold',
						fontsize,
						fontsizeAllowShrink: true,
						halign: 'center',
						valign: 'center',
					},
				],
				steps: spec.steps,
				feedbacks: layeredFeedbacks,
			},
			{
				type: 'simple',
				name: spec.name,
				style: {
					text: spec.text,
					size: 'auto',
					color: IDLE_LABEL,
					bgcolor: IDLE_BG,
				},
				steps: spec.steps,
				feedbacks: simpleFeedbacks,
			},
		],
	}
}
