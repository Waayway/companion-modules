//! Line protocol: `down <n>` / `up <n>`, n = 1..=32.

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Command {
    Down(u8),
    Up(u8),
}

#[derive(Debug, PartialEq, Eq)]
pub struct ParseError(pub String);

pub fn parse(line: &str) -> Result<Command, ParseError> {
    let mut parts = line.split_whitespace();
    let verb = parts
        .next()
        .ok_or_else(|| ParseError("empty line".into()))?;
    let arg = parts
        .next()
        .ok_or_else(|| ParseError("missing button number".into()))?;
    if parts.next().is_some() {
        return Err(ParseError("trailing input".into()));
    }
    let n: u8 = arg
        .parse()
        .map_err(|_| ParseError(format!("bad button number {arg:?}")))?;
    if !(1..=32).contains(&n) {
        return Err(ParseError(format!("button {n} out of range 1..=32")));
    }
    match verb {
        "down" => Ok(Command::Down(n)),
        "up" => Ok(Command::Up(n)),
        _ => Err(ParseError(format!("unknown command {verb:?}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_accepts() {
        assert_eq!(parse("down 1"), Ok(Command::Down(1)));
        assert_eq!(parse("up 32"), Ok(Command::Up(32)));
        assert_eq!(parse("down 7\r"), Ok(Command::Down(7)));
    }

    #[test]
    fn parse_rejects_range() {
        assert!(parse("down 0").is_err());
        assert!(parse("down 33").is_err());
    }

    #[test]
    fn parse_rejects_garbage() {
        assert!(parse("").is_err());
        assert!(parse("foo 1").is_err());
        assert!(parse("down x").is_err());
        assert!(parse("down 1 2").is_err());
    }
}
