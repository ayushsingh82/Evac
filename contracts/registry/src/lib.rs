//! Evac registry: the on-chain root of trust for the DeFi fire exit.
//!
//! One entry per protocol holds the exit kit's hash, the exit manifest (which contracts and methods a
//! withdrawal may touch), the site fingerprint, an alarm status and a blocklist.
//!
//! Who may write what:
//! - `owner_id` (a Sputnik DAO) may write everything and grants the two limited keys below.
//! - the *website key* may call `set_url` only.
//! - the *watcher key* may call `set_status` and `set_blocklist` only.
//!
//! The two limited keys are NEAR function-call access keys added to this contract's own account by
//! `grant_key`. The protocol itself stops them from calling anything else; the contract checks the role
//! as a second lock. A stolen limited key cannot change the release or the manifest.

use near_sdk::store::IterableMap;
use near_sdk::{
    env, near, require, AccountId, Allowance, BorshStorageKey, NearToken, PanicOnDefault, Promise, PublicKey,
};

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum Key {
    Entries,
    Roles,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Role {
    Website,
    Watcher,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Status {
    Ok,
    Degraded,
    Compromised,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    /// sha256 of the published exit kit, e.g. "sha256:ab12..."
    pub release: String,
    /// JSON text: `{"protocol":"burrow","version":1,"contracts":{"<account>":{"methods":["execute"]}}}`
    pub manifest: String,
    /// The protocol's official website.
    pub url: String,
    /// JSON text: sha256 of every script the official site may run.
    pub site: String,
    pub status: Status,
    pub status_note: String,
    /// Nanoseconds since epoch.
    pub status_at: u64,
    /// Look-alike domains to block.
    pub blocklist: Vec<String>,
    pub updated_at: u64,
}

const MAX_TEXT: usize = 16 * 1024;
const MAX_BLOCKLIST: usize = 500;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Registry {
    owner_id: AccountId,
    entries: IterableMap<String, Entry>,
    roles: IterableMap<PublicKey, Role>,
}

#[near]
impl Registry {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        Self {
            owner_id,
            entries: IterableMap::new(Key::Entries),
            roles: IterableMap::new(Key::Roles),
        }
    }

    // ---------- owner only ----------

    pub fn register_protocol(&mut self, protocol: String, manifest: String, url: String) {
        self.assert_owner();
        require!(!protocol.is_empty() && protocol.len() <= 64, "bad protocol id");
        require!(self.entries.get(&protocol).is_none(), "protocol already registered");
        check_len(&manifest);
        check_len(&url);
        let now = env::block_timestamp();
        self.entries.insert(
            protocol,
            Entry {
                release: String::new(),
                manifest,
                url,
                site: String::new(),
                status: Status::Ok,
                status_note: String::new(),
                status_at: now,
                blocklist: vec![],
                updated_at: now,
            },
        );
    }

    pub fn set_release(&mut self, protocol: String, release: String) {
        self.assert_owner();
        check_len(&release);
        let e = self.entry_mut(&protocol);
        e.release = release;
        e.updated_at = env::block_timestamp();
    }

    pub fn set_manifest(&mut self, protocol: String, manifest: String) {
        self.assert_owner();
        check_len(&manifest);
        let e = self.entry_mut(&protocol);
        e.manifest = manifest;
        e.updated_at = env::block_timestamp();
    }

    pub fn set_site(&mut self, protocol: String, site: String) {
        self.assert_owner();
        check_len(&site);
        let e = self.entry_mut(&protocol);
        e.site = site;
        e.updated_at = env::block_timestamp();
    }

    pub fn set_owner(&mut self, new_owner: AccountId) {
        self.assert_owner();
        self.owner_id = new_owner;
    }

    /// Add a limited function-call key to this contract's account and record its role.
    /// Website keys may call only `set_url`; watcher keys only `set_status` and `set_blocklist`.
    pub fn grant_key(&mut self, public_key: PublicKey, role: Role, allowance_yocto: near_sdk::json_types::U128) -> Promise {
        self.assert_owner();
        let methods = match role {
            Role::Website => "set_url",
            Role::Watcher => "set_status,set_blocklist",
        };
        self.roles.insert(public_key.clone(), role);
        Promise::new(env::current_account_id()).add_access_key_allowance(
            public_key,
            Allowance::limited(NearToken::from_yoctonear(allowance_yocto.0)).expect("allowance must be above zero"),
            env::current_account_id(),
            methods.to_string(),
        )
    }

    pub fn revoke_key(&mut self, public_key: PublicKey) -> Promise {
        self.assert_owner();
        self.roles.remove(&public_key);
        Promise::new(env::current_account_id()).delete_key(public_key)
    }

    // ---------- limited keys (or the owner) ----------

    pub fn set_url(&mut self, protocol: String, url: String) {
        self.assert_role_or_owner(Role::Website);
        check_len(&url);
        let e = self.entry_mut(&protocol);
        e.url = url;
        e.updated_at = env::block_timestamp();
    }

    pub fn set_status(&mut self, protocol: String, status: Status, note: String) {
        self.assert_role_or_owner(Role::Watcher);
        require!(note.len() <= 280, "note too long");
        let now = env::block_timestamp();
        let e = self.entry_mut(&protocol);
        e.status = status;
        e.status_note = note;
        e.status_at = now;
        e.updated_at = now;
    }

    pub fn set_blocklist(&mut self, protocol: String, domains: Vec<String>) {
        self.assert_role_or_owner(Role::Watcher);
        require!(domains.len() <= MAX_BLOCKLIST, "blocklist too long");
        for d in &domains {
            require!(d.len() <= 253, "domain too long");
        }
        let e = self.entry_mut(&protocol);
        e.blocklist = domains;
        e.updated_at = env::block_timestamp();
    }

    // ---------- views ----------

    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }

    pub fn get_entry(&self, protocol: String) -> Option<Entry> {
        self.entries.get(&protocol).cloned()
    }

    pub fn list_protocols(&self, from: Option<u32>, limit: Option<u32>) -> Vec<String> {
        self.entries
            .keys()
            .skip(from.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .cloned()
            .collect()
    }

    pub fn get_role(&self, public_key: PublicKey) -> Option<Role> {
        self.roles.get(&public_key).copied()
    }
}

impl Registry {
    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "owner only");
    }

    /// The owner may always write. Otherwise the call must come from this contract's own account (a
    /// function-call key) and the signing key must hold the required role.
    fn assert_role_or_owner(&self, needed: Role) {
        if env::predecessor_account_id() == self.owner_id {
            return;
        }
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "owner or a granted key only"
        );
        let role = self.roles.get(&env::signer_account_pk());
        require!(role == Some(&needed), "this key does not hold the required role");
    }

    fn entry_mut(&mut self, protocol: &str) -> &mut Entry {
        self.entries.get_mut(protocol).unwrap_or_else(|| env::panic_str("unknown protocol"))
    }
}

fn check_len(s: &str) {
    require!(s.len() <= MAX_TEXT, "text too long");
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn acct(s: &str) -> AccountId {
        s.parse().unwrap()
    }
    fn pk(n: u8) -> PublicKey {
        let mut bytes = vec![0u8]; // ED25519 key type
        bytes.extend([n; 32]);
        PublicKey::try_from(bytes).unwrap()
    }
    fn ctx(predecessor: &str, signer_pk: Option<PublicKey>) {
        let mut b = VMContextBuilder::new();
        b.current_account_id(acct("registry.near"))
            .predecessor_account_id(acct(predecessor))
            .signer_account_id(acct(predecessor));
        if let Some(k) = signer_pk {
            b.signer_account_pk(k);
        }
        testing_env!(b.build());
    }
    fn setup() -> Registry {
        ctx("dao.near", None);
        let mut r = Registry::new(acct("dao.near"));
        r.register_protocol("burrow".into(), "{\"v\":1}".into(), "https://app.burrow.finance".into());
        r
    }

    #[test]
    fn owner_writes_everything() {
        let mut r = setup();
        r.set_release("burrow".into(), "sha256:aa".into());
        r.set_manifest("burrow".into(), "{\"v\":2}".into());
        r.set_site("burrow".into(), "{\"scripts\":[]}".into());
        r.set_status("burrow".into(), Status::Degraded, "slow".into());
        r.set_blocklist("burrow".into(), vec!["burrow-finance.xyz".into()]);
        let e = r.get_entry("burrow".into()).unwrap();
        assert_eq!(e.release, "sha256:aa");
        assert_eq!(e.status, Status::Degraded);
        assert_eq!(e.blocklist.len(), 1);
    }

    #[test]
    #[should_panic(expected = "owner only")]
    fn stranger_cannot_set_release() {
        let mut r = setup();
        ctx("mallory.near", None);
        r.set_release("burrow".into(), "sha256:evil".into());
    }

    #[test]
    #[should_panic(expected = "owner only")]
    fn stranger_cannot_register_or_grant() {
        let mut r = setup();
        ctx("mallory.near", None);
        let _ = r.grant_key(pk(9), Role::Watcher, near_sdk::json_types::U128(1_000_000));
    }

    #[test]
    fn watcher_key_can_set_status_and_blocklist() {
        let mut r = setup();
        let _ = r.grant_key(pk(2), Role::Watcher, near_sdk::json_types::U128(1_000_000_000_000_000_000_000));
        ctx("registry.near", Some(pk(2)));
        r.set_status("burrow".into(), Status::Compromised, "script hash changed".into());
        r.set_blocklist("burrow".into(), vec!["evil.example".into()]);
        let e = r.get_entry("burrow".into()).unwrap();
        assert_eq!(e.status, Status::Compromised);
        assert_eq!(e.blocklist, vec!["evil.example".to_string()]);
    }

    #[test]
    #[should_panic(expected = "owner only")]
    fn watcher_key_cannot_change_release() {
        let mut r = setup();
        let _ = r.grant_key(pk(2), Role::Watcher, near_sdk::json_types::U128(1_000_000_000_000_000_000_000));
        ctx("registry.near", Some(pk(2)));
        r.set_release("burrow".into(), "sha256:evil".into());
    }

    #[test]
    #[should_panic(expected = "owner only")]
    fn watcher_key_cannot_change_manifest() {
        let mut r = setup();
        let _ = r.grant_key(pk(2), Role::Watcher, near_sdk::json_types::U128(1_000_000_000_000_000_000_000));
        ctx("registry.near", Some(pk(2)));
        r.set_manifest("burrow".into(), "{\"contracts\":{\"evil.near\":{}}}".into());
    }

    #[test]
    #[should_panic(expected = "does not hold the required role")]
    fn website_key_cannot_set_status() {
        let mut r = setup();
        let _ = r.grant_key(pk(3), Role::Website, near_sdk::json_types::U128(1_000_000_000_000_000_000_000));
        ctx("registry.near", Some(pk(3)));
        r.set_status("burrow".into(), Status::Ok, "".into());
    }

    #[test]
    fn website_key_can_set_url_only() {
        let mut r = setup();
        let _ = r.grant_key(pk(3), Role::Website, near_sdk::json_types::U128(1_000_000_000_000_000_000_000));
        ctx("registry.near", Some(pk(3)));
        r.set_url("burrow".into(), "https://new.burrow.finance".into());
        assert_eq!(r.get_entry("burrow".into()).unwrap().url, "https://new.burrow.finance");
    }

    #[test]
    #[should_panic(expected = "does not hold the required role")]
    fn unknown_key_on_the_contract_account_is_refused() {
        let mut r = setup();
        ctx("registry.near", Some(pk(7)));
        r.set_status("burrow".into(), Status::Ok, "".into());
    }

    #[test]
    #[should_panic(expected = "does not hold the required role")]
    fn revoked_key_loses_its_role() {
        let mut r = setup();
        let _ = r.grant_key(pk(2), Role::Watcher, near_sdk::json_types::U128(1_000_000_000_000_000_000_000));
        let _ = r.revoke_key(pk(2));
        ctx("registry.near", Some(pk(2)));
        r.set_status("burrow".into(), Status::Ok, "".into());
    }

    #[test]
    #[should_panic(expected = "owner or a granted key only")]
    fn another_contract_cannot_write_status() {
        let mut r = setup();
        ctx("mallory.near", None);
        r.set_status("burrow".into(), Status::Ok, "".into());
    }

    #[test]
    #[should_panic(expected = "protocol already registered")]
    fn cannot_register_twice() {
        let mut r = setup();
        r.register_protocol("burrow".into(), "{}".into(), "x".into());
    }

    #[test]
    #[should_panic(expected = "unknown protocol")]
    fn unknown_protocol_is_refused() {
        let mut r = setup();
        r.set_release("nope".into(), "sha256:aa".into());
    }

    #[test]
    #[should_panic(expected = "text too long")]
    fn oversized_text_is_refused() {
        let mut r = setup();
        r.set_manifest("burrow".into(), "x".repeat(MAX_TEXT + 1));
    }

    #[test]
    fn owner_can_transfer_ownership() {
        let mut r = setup();
        r.set_owner(acct("newdao.near"));
        assert_eq!(r.get_owner(), acct("newdao.near"));
    }
}
