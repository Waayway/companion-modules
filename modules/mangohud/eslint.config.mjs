import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default generateEslintConfig({
	enableTypescript: true,
}).then((config) => [
	...config,
	{
		// node:test's test() returns a promise that is intentionally not awaited at the top level
		files: ['**/*.test.ts'],
		rules: {
			'@typescript-eslint/no-floating-promises': 'off',
		},
	},
])
