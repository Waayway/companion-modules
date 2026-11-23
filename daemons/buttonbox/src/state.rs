//! Hold tracking: a button is pressed while at least one client holds it.

use std::collections::{HashMap, HashSet};

#[derive(Default)]
pub struct Holds {
    clients: HashMap<u64, HashSet<u8>>,
    counts: HashMap<u8, usize>,
}

impl Holds {
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns the device transition to emit, if any.
    pub fn down(&mut self, client: u64, n: u8) -> Option<(u8, bool)> {
        if !self.clients.entry(client).or_default().insert(n) {
            return None;
        }
        let c = self.counts.entry(n).or_insert(0);
        *c += 1;
        (*c == 1).then_some((n, true))
    }

    pub fn up(&mut self, client: u64, n: u8) -> Option<(u8, bool)> {
        if !self.clients.get_mut(&client)?.remove(&n) {
            return None;
        }
        self.dec(n)
    }

    pub fn release_client(&mut self, client: u64) -> Vec<(u8, bool)> {
        let mut held: Vec<u8> = self
            .clients
            .remove(&client)
            .map(|s| s.into_iter().collect())
            .unwrap_or_default();
        held.sort_unstable();
        held.into_iter().filter_map(|n| self.dec(n)).collect()
    }

    fn dec(&mut self, n: u8) -> Option<(u8, bool)> {
        let c = self.counts.get_mut(&n)?;
        *c -= 1;
        if *c == 0 {
            self.counts.remove(&n);
            Some((n, false))
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_hold_counts() {
        let mut h = Holds::new();
        assert_eq!(h.down(1, 5), Some((5, true)));
        assert_eq!(h.down(2, 5), None);
        assert_eq!(h.up(1, 5), None);
        assert_eq!(h.up(2, 5), Some((5, false)));
    }

    #[test]
    fn up_without_down_is_noop() {
        let mut h = Holds::new();
        assert_eq!(h.up(1, 3), None);
    }

    #[test]
    fn repeat_down_same_client_is_idempotent() {
        let mut h = Holds::new();
        h.down(1, 4);
        h.down(1, 4);
        assert_eq!(h.up(1, 4), Some((4, false)));
    }

    #[test]
    fn release_all_on_disconnect() {
        let mut h = Holds::new();
        h.down(1, 1);
        h.down(1, 2);
        h.down(2, 2);
        assert_eq!(h.release_client(1), vec![(1, false)]);
    }
}
