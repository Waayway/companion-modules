//! The uinput joystick.

use evdev::uinput::VirtualDevice;
use evdev::{AbsInfo, AbsoluteAxisCode, AttributeSet, BusType, EventType, InputEvent, InputId};
use evdev::{KeyCode, UinputAbsSetup};
use std::io;

/// Button n (1-based) -> key code. SDL and Wine number buttons in this order:
/// BTN_TRIGGER..=BTN_DEAD (16), BTN_SOUTH..=BTN_THUMBR (15), BTN_TRIGGER_HAPPY1.
fn code(n: u8) -> KeyCode {
    let i = u16::from(n) - 1;
    KeyCode::new(match i {
        0..=15 => 0x120 + i,
        16..=30 => 0x130 + (i - 16),
        _ => 0x2c0,
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
    fn codes_follow_sdl_order() {
        assert_eq!(code(1), KeyCode::BTN_TRIGGER);
        assert_eq!(code(3), KeyCode::BTN_THUMB2);
        assert_eq!(code(16), KeyCode::BTN_DEAD);
        assert_eq!(code(17), KeyCode::BTN_SOUTH);
        assert_eq!(code(31), KeyCode::BTN_THUMBR);
        assert_eq!(code(32), KeyCode::BTN_TRIGGER_HAPPY1);
    }
}
