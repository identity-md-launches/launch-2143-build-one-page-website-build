# Website terminal

A one-page, Matrix-style interface to the verified Ethereum `WebsiteBuyer` contract at **`0x2fC2ca1b6Accec8CBE479c4EB970c67AF4bDd748`**. Describe a website, estimate an ETH payment, review the swap, buy through a wallet, and track the resulting request.

The finished static site is included in **`dist/`**. It contains its own JavaScript, fonts, wallet marks, favicon, share image, and verified ABI. Vite uses `base: './'`; asset URLs work at a static gateway subpath. Navigation uses hashes and needs no server rewrites.

## Install, preview, rebuild

Use Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

To check and regenerate the production export:

```sh
npm run typecheck
npm run build
npm run preview
```

Open the local URL printed by Vite. Serve or upload the complete `dist/` directory for static hosting. The delivered export works without installing build dependencies on its host.

Additional checks:

```sh
npm run check:export
npx playwright install chromium
npm run validate:browser
```

`validate:browser` serves the actual export under `/preview/` inside a bounded foreground process, checks mobile and desktop layouts, keyboard interaction, form validation and accessibility, then closes its browser and server. Its output goes to disposable `test/scratch/browser-validation/`. It never connects an account or sends a transaction.

Dependencies and browser downloads are development files, not part of the submission. Keep `node_modules`, package caches, browser binaries and scratch output out of Git at every directory level. No ignore file was added or changed for this delivery. The worker installed dependencies outside the repository; Vite and the browser check also support an optional `IMD_FRONTEND_DEPENDENCIES` directory for that setup. Normal `npm ci` needs no such setting.

## Purchase and tracking

1. Enter a single-paragraph brief of at most 1,000 UTF-8 bytes. The contract rejects double quotes, backslashes, ASCII control characters and malformed UTF-8; the form checks these before quoting.
2. Enter ETH or choose **Estimate**. The estimate targets 2% more IMD than the current service price through the contract's Uniswap v4 pool. It is a quote, not a fixed exchange rate.
3. Choose **Review purchase**. A fresh exact-input quote shows the entire ETH spend, service price, expected surplus IMD, minimum surplus, and transaction deadline. Quotes expire after 60 seconds and can be refreshed.
4. Connect a wallet and choose **Buy website**. The site simulates the exact call, then requests `buyWebsiteWithMinimum(words, minSurplus, deadline)` on Ethereum, chain ID 1. The minimum return uses a 1% tolerance against quoted total IMD output; the transaction deadline is ten minutes from quote creation. The wallet calculates the network fee and asks for final confirmation.
5. After confirmation, the site decodes `WebsiteRequested` from this contract's receipt, saves the transaction and request ID in this browser, and opens request tracking. Existing requests can also be found using their ID or transaction hash. A `#request/<id>` link works after reload without a wallet.

**The complete ETH amount is swapped.** The contract pays the live service price in IMD and returns surplus IMD. A request that is refused or ends without a result does not refund the service price. Briefs and transactions are public. The interface explains these facts before signing.

Tracking reads `requestOf`, displays pending, completed, failed and unknown states, and refreshes pending requests every 15 seconds. Completed results support HTTPS, HTTP and IPFS URLs; executable or credential-bearing URLs are not opened. If a result URI exceeds the contract's stored length, the site retrieves its `WebsiteResult` event, with a retry and an Etherscan fallback if the RPC cannot serve the log range. Browser history contains only transaction metadata and request IDs, not a shared activity feed.

## Wallets and configuration

- EIP-6963 discovers and names installed browser wallets. The generic row reads “Browser wallet” and disappears when named extensions are found.
- Mobile browsers without an injected wallet offer MetaMask, Coinbase Wallet, Rabby and Phantom links that reopen this same URL in the wallet's browser.
- Coinbase Wallet's SDK provides its wallet and passkey/Smart Wallet path. No WalletConnect relay, project ID, private key, backend or owner-supplied credential is required.
- Network switching uses wagmi's Ethereum chain metadata, including `wallet_addEthereumChain` fallback. The account control supports disconnect and stored reconnection.

Addresses, selected ABI functions, public RPC fallbacks and quote logic live in [`src/lib/contract.ts`](src/lib/contract.ts). Wallet configuration is in [`src/wallet/config.ts`](src/wallet/config.ts); mobile links are in [`src/wallet/open-in.ts`](src/wallet/open-in.ts). The active intake, action, token decimals, pause state, pool and price are read from Ethereum rather than represented by sample data. The full verified ABI is in [`public/contract/WebsiteBuyer.abi.json`](public/contract/WebsiteBuyer.abi.json).

The visitor interface covers purchases and request retrieval. Owner administration and service callbacks remain contract-level functions, available in the full ABI and explorer.

## Validation performed

The worker ran the production build and strict TypeScript check successfully, inspected the real export in Chromium, exercised live Ethereum reads and both quote directions, and looked up an actual completed request. Separate RPC/provider fixtures exercised wallet rejection, EIP-6963 discovery, network switching, transaction encoding, receipt recovery and request failure/result states without broadcasting a purchase.

The final taste@1 probe passed all 16 checks. The browser smoke check passed nine groups, and the expanded interaction run passed 33 checks with WebKit recorded as unavailable. Results and byte counts are recorded in [`artifacts/validation.md`](artifacts/validation.md). The review covers all six Better Interface domains, including the fixes to modal focus, touch targets, enlarged-text reflow and stale-read wording. [`DESIGN.md`](DESIGN.md) records the implemented design system.

Real wallet signing, Coinbase account creation, physical mobile app handoff, screen-reader use, browser-native zoom and Safari/WebKit are unverified. WebKit could not launch because its runtime shared libraries were unavailable; standalone Chromium supplied the rendered evidence after the provided browser launcher reported missing Chrome. Public RPC and wallet vendor availability remain runtime dependencies. Build, interaction and design results are worker observations, not independent certification.

## Sources and attribution

Contract identity, ABI and behavior were checked against [the verified Ethereum source](https://etherscan.io/address/0x2fc2ca1b6accec8cbe479c4eb970c67af4bdd748#code). The quoter address was checked against [Uniswap's Ethereum v4 deployments](https://developers.uniswap.org/docs/protocols/v4/deployments); quote parameters follow [IV4Quoter](https://github.com/Uniswap/v4-periphery/blob/main/src/interfaces/IV4Quoter.sol). Rabby's mobile link parameters follow its [universal-link handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts).

Local IBM Plex Mono fonts and wallet marks retain their notices in [`licenses/`](licenses/). Better Interface and Impeccable design/documentation guidance are credited in [`licenses/NOTICE.md`](licenses/NOTICE.md), with their supplied license texts retained.
