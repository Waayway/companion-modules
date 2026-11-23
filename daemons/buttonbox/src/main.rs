use std::process::ExitCode;

const USAGE: &str = "companion-buttonbox: virtual joystick for the Companion buttonbox module

Usage: companion-buttonbox [--help]

Creates a uinput device \"Companion Button Box\" (32 buttons) and listens on
$XDG_RUNTIME_DIR/companion-buttonbox.sock for `down <n>` / `up <n>` lines.";

fn main() -> ExitCode {
    env_logger::init();
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("--help" | "-h") => {
            println!("{USAGE}");
            ExitCode::SUCCESS
        }
        _ => {
            eprintln!("{USAGE}");
            ExitCode::from(2)
        }
    }
}
