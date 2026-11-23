//! Hold tracking: a button is pressed while at least one client holds it.

use std::collections::HashMap;

#[derive(Default)]
pub struct Holds {
    /// Per client: button -> number of downs not yet matched by an up.
    clients: HashMap<u64, HashMap<u8, usize>>,
    /// Total holds per button over all clients.
    counts: HashMap<u8, usize>,
}

impl Holds {
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns the device transition to emit, if any.
    pub fn down(&mut self, client: u64, n: u8) -> Option<(u8, bool)> {
        *self
            .clients
            .entry(client)
            .or_default()
            .entry(n)
            .or_insert(0) += 1;
        let c = self.counts.entry(n).or_insert(0);
        *c += 1;
        (*c == 1).then_some((n, true))
    }

    pub fn up(&mut self, client: u64, n: u8) -> Option<(u8, bool)> {
        let held = self.clients.get_mut(&client)?;
        let c = held.get_mut(&n)?;
        *c -= 1;
        if *c == 0 {
            held.remove(&n);
        }
        self.dec(n, 1)
    }

    pub fn release_client(&mut self, client: u64) -> Vec<(u8, bool)> {
        let mut held: Vec<(u8, usize)> = self
            .clients
            .remove(&client)
            .map(|m| m.into_iter().collect())
            .unwrap_or_default();
        held.sort_unstable();
        held.into_iter()
            .filter_map(|(n, by)| self.dec(n, by))
            .collect()
    }

    fn dec(&mut self, n: u8, by: usize) -> Option<(u8, bool)> {
        let c = self.counts.get_mut(&n)?;
        *c = c.saturating_sub(by);
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
    fn same_client_needs_matching_ups() {
        let mut h = Holds::new();
        assert_eq!(h.down(1, 4), Some((4, true)));
        assert_eq!(h.down(1, 4), None);
        assert_eq!(h.up(1, 4), None);
        assert_eq!(h.up(1, 4), Some((4, false)));
    }

    #[test]
    fn same_client_shared_hold() {
        let mut h = Holds::new();
        assert_eq!(h.down(1, 5), Some((5, true)));
        assert_eq!(h.down(1, 5), None);
        assert_eq!(h.up(1, 5), None);
        assert_eq!(h.counts.get(&5), Some(&1));
    }

    #[test]
    fn release_ignores_count() {
        let mut h = Holds::new();
        h.down(1, 6);
        h.down(1, 6);
        assert_eq!(h.release_client(1), vec![(6, false)]);
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
