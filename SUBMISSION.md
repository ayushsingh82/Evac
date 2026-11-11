# Submission (hackathon form)

- **Project name:** Evac
- **Tracks:** Unstoppable DeFi, AI Security & Defense, Open Innovation
- **Live site:** https://getevac.vercel.app
- **Repository:** (publish this folder as a public repo; judges cannot open private ones)
- **Demo post:** (X post with video, tagging @NEARProtocol and #NEARHackathon)
- **Wallet:** (your .near address for prizes)
- **Deadline:** 14 Nov 2026, 23:59 UTC. Submit early.

## "What did you build?" (draft, 20-2,000 characters; edit to match what actually works on demo day)

Evac is a fire exit for NEAR DeFi. When a protocol's website is down or hijacked, the funds are still in its contracts, but users have no safe way to reach them. Evac reads your Burrow position directly from the contracts through four independent RPC providers pinned to one block, builds the withdrawal locally, and runs it through an Exit Guard that refuses anything that is not a plain withdrawal to you: no AddKey, no transfers, no unknown contracts or methods, exact 1 yocto deposit, undecodable input rejected. After signing with NEAR wallet-selector it only says "Recovered" if every receipt succeeded and the token balances rose, which matters on NEAR because a failed token transfer can hide behind a successful first receipt. A Rust registry contract, owned by a DAO, publishes the kit hash, exit manifest, site fingerprint and alarm status; the website key and the watcher agent use NEAR function-call access keys limited to single methods, so a stolen key cannot change the release. A watcher fingerprints the live site and raises Compromised on changed or injected scripts. An optional last step sends funds to USDC on another chain through NEAR Intents' 1Click API, guarded to the exact quoted transfer. Accounts with a loan can exit fully when their other deposits cover it (repay, then withdraw), or partially otherwise. The app is a static, reproducible build with no server of ours in the path, and it can be saved as a verifiable kit; a Chrome extension warns on look-alike sites and changed scripts. 111 TypeScript tests and 15 contract tests.

(About 1,500 characters. Remove the registry/watcher sentences if they are not deployed by submission day.)
