mod device;
mod protocol;
mod state;

use device::ButtonBox;
use log::{info, warn};
use protocol::Command;
use state::Holds;
use std::io::{self, BufRead, BufReader, Read};
use std::os::unix::fs::FileTypeExt;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::{Arc, Mutex};
use std::thread;

/// Longest accepted line, newline included.
const MAX_LINE: u64 = 64;

const USAGE: &str = "companion-buttonbox: virtual joystick for the Companion buttonbox module

Usage: companion-buttonbox [--socket <path>] [--help]

Creates a uinput device \"Companion Button Box\" (32 buttons) and listens on
$XDG_RUNTIME_DIR/companion-buttonbox.sock (or --socket) for `down <n>` /
`up <n>` lines. A button stays pressed while any client holds it; a client's
holds are released when it disconnects.";

struct Shared {
    holds: Holds,
    device: ButtonBox,
}

impl Shared {
    fn apply(&mut self, transitions: impl IntoIterator<Item = (u8, bool)>) {
        for (n, pressed) in transitions {
            if let Err(e) = self.device.set(n, pressed) {
                warn!("uinput write failed: {e}");
            }
        }
    }
}

type State = Arc<Mutex<Shared>>;

fn lock(state: &State) -> std::sync::MutexGuard<'_, Shared> {
    state.lock().unwrap_or_else(|e| e.into_inner())
}

fn handle_client(id: u64, stream: UnixStream, state: State) {
    info!("client {id} connected");
    let mut reader = BufReader::new(stream);
    let mut buf = Vec::new();
    loop {
        buf.clear();
        // Cap the read so a client without newlines cannot grow the buffer.
        match (&mut reader).take(MAX_LINE).read_until(b'\n', &mut buf) {
            Ok(0) | Err(_) => break,
            Ok(_) => {}
        }
        if buf.last() != Some(&b'\n') {
            if buf.len() as u64 >= MAX_LINE {
                warn!("client {id}: line longer than {MAX_LINE} bytes, disconnecting");
            }
            break;
        }
        let line = String::from_utf8_lossy(&buf);
        match protocol::parse(&line) {
            Ok(cmd) => {
                let mut s = lock(&state);
                let t = match cmd {
                    Command::Down(n) => s.holds.down(id, n),
                    Command::Up(n) => s.holds.up(id, n),
                };
                s.apply(t);
            }
            Err(e) => warn!("client {id}: {}: {:?}", e.0, line.trim_end()),
        }
    }
    let mut s = lock(&state);
    let released = s.holds.release_client(id);
    s.apply(released);
    info!("client {id} disconnected");
}

/// Blocks SIGINT/SIGTERM in this thread (inherited by all later threads) and
/// returns the set so a dedicated thread can `sigwait` on it.
fn block_signals() -> libc::sigset_t {
    // SAFETY: plain libc calls on a locally owned, initialised sigset.
    unsafe {
        let mut set: libc::sigset_t = std::mem::zeroed();
        libc::sigemptyset(&mut set);
        libc::sigaddset(&mut set, libc::SIGINT);
        libc::sigaddset(&mut set, libc::SIGTERM);
        libc::pthread_sigmask(libc::SIG_BLOCK, &set, std::ptr::null_mut());
        set
    }
}

/// Removes a stale socket so we can bind. Refuses when a daemon is live there
/// or the path is not a socket.
fn claim_socket_path(path: &std::path::Path) -> io::Result<()> {
    let meta = match std::fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e),
    };
    if !meta.file_type().is_socket() {
        return Err(io::Error::other(format!(
            "{} exists and is not a socket, refusing to remove it",
            path.display()
        )));
    }
    match UnixStream::connect(path) {
        Ok(_) => Err(io::Error::new(
            io::ErrorKind::AddrInUse,
            format!(
                "another companion-buttonbox is already listening on {}",
                path.display()
            ),
        )),
        Err(e) if e.kind() == io::ErrorKind::ConnectionRefused => std::fs::remove_file(path),
        Err(e) => Err(e),
    }
}

fn run(socket: PathBuf) -> io::Result<()> {
    let sigs = block_signals();
    let device = ButtonBox::create()
        .map_err(|e| io::Error::new(e.kind(), format!("cannot create uinput device: {e}")))?;
    let state: State = Arc::new(Mutex::new(Shared {
        holds: Holds::new(),
        device,
    }));

    claim_socket_path(&socket)?;
    let listener = UnixListener::bind(&socket)
        .map_err(|e| io::Error::new(e.kind(), format!("cannot bind {}: {e}", socket.display())))?;
    info!("listening on {}", socket.display());

    {
        let state = state.clone();
        let socket = socket.clone();
        thread::spawn(move || {
            let mut sig = 0;
            // SAFETY: sigs is a valid sigset; sig is a valid out pointer.
            unsafe { libc::sigwait(&sigs, &mut sig) };
            info!("signal {sig}, shutting down");
            let mut s = lock(&state);
            for n in 1..=32 {
                let _ = s.device.set(n, false);
            }
            let _ = std::fs::remove_file(&socket);
            std::process::exit(0);
        });
    }

    let mut next_id = 0u64;
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                next_id += 1;
                let (id, state) = (next_id, state.clone());
                thread::spawn(move || handle_client(id, stream, state));
            }
            Err(e) => {
                warn!("accept failed: {e}");
                thread::sleep(std::time::Duration::from_millis(100));
            }
        }
    }
    Ok(())
}

fn main() -> ExitCode {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    let mut socket = None;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--help" | "-h" => {
                println!("{USAGE}");
                return ExitCode::SUCCESS;
            }
            "--socket" => match args.next() {
                Some(p) => socket = Some(PathBuf::from(p)),
                None => {
                    eprintln!("{USAGE}");
                    return ExitCode::from(2);
                }
            },
            _ => {
                eprintln!("{USAGE}");
                return ExitCode::from(2);
            }
        }
    }
    let socket = socket.unwrap_or_else(|| {
        // SAFETY: getuid has no preconditions and cannot fail.
        let uid = unsafe { libc::getuid() };
        let dir = std::env::var_os("XDG_RUNTIME_DIR")
            .unwrap_or_else(|| format!("/run/user/{uid}").into());
        PathBuf::from(dir).join("companion-buttonbox.sock")
    });
    match run(socket) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("companion-buttonbox: {e}");
            ExitCode::FAILURE
        }
    }
}
