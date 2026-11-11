# Demo plan (about 90 seconds)

Rehearse on a **$5 test position** in a separate account. Record real transactions; do not mock the outage.

| Time | Show | Say |
|---|---|---|
| 0:00 | The protocol's website, where you manage your position | "This is where I manage my DeFi position." |
| 0:08 | Block the site (add `127.0.0.1 <the site's domain>` to `/etc/hosts`), reload: it fails | "Now the website is down or hijacked." |
| 0:18 | Open Evac from the local static build (`out/`), banner shows the exit list comes from the registry (or built-in) | "Evac is a static file. No server of ours." |
| 0:25 | Scan the account: providers agreed at one block | "It reads my position straight from the contracts, several providers must agree." |
| 0:35 | Exit plan and the green Guard verdict | "It built the withdrawal itself and its Guard checked every action." |
| 0:45 | Connect wallet, **Sign and exit** | "Only a plain withdrawal to me can pass." |
| 0:55 | "Recovered" with per-token before/after | "Recovered means every step succeeded and my balance actually rose." |
| 1:05 | Paste the sample malicious transaction (AddKey): REFUSED | "A hijacked site would try to add its own key. Refused." |
| 1:10 | Extension: open `/extension`, then the local demo pages (`npm run demo:sites`): clean page stays quiet, tampered page and look-alike get a red banner | "The extension warns on the page itself, before I sign anything." |
| 1:15 | Optional: preview a bridge to USDC on Base | "And I can leave the chain through NEAR Intents." |
| 1:25 | Repo, tests (111 + 15), registry contract, function-call keys | "The registry's keys are NEAR function-call keys, so a stolen key cannot change the release." |

Post on X: video, one sentence on the problem (the website is the weak point of "decentralized" DeFi), one on how it works,
tag @NEARProtocol and #NEARHackathon, and say it was built at NEAR HACKATHON.

Before recording the extension part: `npm run extension`, load `extension/dist` in Chrome, run `npm run demo:sites`, paste the
printed JSON into the extension's Settings under Demo data. Say it is demo data standing in for the registry.

Honesty checklist before recording: only show features you ran. If the registry is not deployed, say the exit list is
built in and show the contract's tests instead.
