import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FCAT_COMMAND, HUD_COMMAND, loggingCommand } from './commands.js'

test('HUD_COMMAND and FCAT_COMMAND are the exact MangoHud control bytes', () => {
	assert.equal(HUD_COMMAND, ':hud;')
	assert.equal(FCAT_COMMAND, ':fcat;')
})

test('loggingCommand builds the start/stop/toggle variants', () => {
	assert.equal(loggingCommand(1), ':logging=1;')
	assert.equal(loggingCommand(0), ':logging=0;')
	assert.equal(loggingCommand(), ':logging;')
})
