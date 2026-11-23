//! The uinput joystick.

use evdev::uinput::VirtualDevice;
use evdev::{AbsInfo, AbsoluteAxisCode, AttributeSet, BusType, EventType, InputEvent, InputId};
use evdev::{KeyCode, UinputAbsSetup};
use std::io;

/// Button n (1-based) -> key code: BTN_TRIGGER..=BTN_DEAD (0x120..=0x12f) for
/// buttons 1-16, then BTN_TRIGGER_HAPPY1..=BTN_TRIGGER_HAPPY16 (0x2c0..=0x2cf)
/// for 17-32. The gamepad range (BTN_SOUTH.., 0x130..) is skipped on purpose:
/// SDL would classify the device as a gamepad and may hide buttons.
fn code(n: u8) -> KeyCode {
    let i = u16::from(n) - 1;
    KeyCode::new(match i {
        0..=15 => 0x120 + i,
        _ => 0x2c0 + (i - 16),
    })
}

pub struct ButtonBox {
    dev: VirtualDevice,
}

impl ButtonBox {
    pub fn create() -> io::Result<Self> {
        let mut keys = AttributeSet::<KeyCode>::new();
        for n in 1..=32 {
            keys.insert(code(n));
        }
        // Axes that never move: Wine's DirectInput and some games ignore
        // axis-less devices.
        let axis = AbsInfo::new(0, -32767, 32767, 0, 0, 0);
        // 0x1209:0x0001 is pid.codes' shared test PID, kept deliberately. Changing
        // the name or these IDs makes games forget their button bindings.
        let dev = VirtualDevice::builder()?
            .name("Companion Button Box")
            .input_id(InputId::new(BusType::BUS_USB, 0x1209, 0x0001, 1))
            .with_keys(&keys)?
            .with_absolute_axis(&UinputAbsSetup::new(AbsoluteAxisCode::ABS_X, axis))?
            .with_absolute_axis(&UinputAbsSetup::new(AbsoluteAxisCode::ABS_Y, axis))?
            .build()?;
        Ok(Self { dev })
    }

    /// Emits a key event followed by SYN.
    pub fn set(&mut self, n: u8, pressed: bool) -> io::Result<()> {
        let ev = InputEvent::new(EventType::KEY.0, code(n).code(), i32::from(pressed));
        self.dev.emit(&[ev])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_joystick_only() {
        assert_eq!(code(1), KeyCode::BTN_TRIGGER);
        assert_eq!(code(3), KeyCode::BTN_THUMB2);
        assert_eq!(code(16), KeyCode::BTN_DEAD);
        assert_eq!(code(17), KeyCode::BTN_TRIGGER_HAPPY1);
        assert_eq!(code(32), KeyCode::BTN_TRIGGER_HAPPY16);
    }
}
