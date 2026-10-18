# Website terminal design

## Overview

This is a consumer interface to Ethereum's WebsiteBuyer contract. Its working surface is the purchase form, with request tracking available through the same workspace. The requested “matrix style” is implemented with a nearly black green palette, IBM Plex Mono, square terminal controls and a small static binary illustration. The illustration is decorative; it does not represent network traffic or activity.

The product and its main action precede the contract explanation. One filled action leads each active surface. Supporting material uses simple text, whitespace and separators. There are no marketing sections, invented activity counters, shadows, glow effects or continuous animations. The fixed dark appearance and monospace prose are deliberate parts of this implementation.

The source of truth is [`src/styles.css`](src/styles.css), followed by the components in `src/components/`, [`src/wallet/Wallet.tsx`](src/wallet/Wallet.tsx), and [`src/App.tsx`](src/App.tsx).

## Colors

CSS defines hue primitives and semantic aliases in `:root`. Components consume the semantic aliases. The palette uses sRGB hex values throughout.

| Semantic token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#060b08` | Page background; text on the primary action |
| `--color-surface` | `#0b120e` | Workspace, dialog and error popover |
| `--color-field` | `#101b14` | Editable field background |
| `--color-hover` | `#17271d` | Neutral hover/pressed surface |
| `--color-border` | `#304b38` | Structural separators |
| `--color-input-border` | `#5c8066` | Field and neutral-control boundaries |
| `--color-text` | `#e3f0e6` | Primary text |
| `--color-muted` | `#94af9b` | Supporting text and default icons |
| `--color-secondary` | `#c6ddcb` | Links, secondary labels, contract values |
| `--color-accent` | `#91fca6` | Primary fill, selected navigation, terminal mark |
| `--color-accent-hover` | `#b0ffbf` | Primary hover fill |
| `--color-on-accent` | `#060b08` | Primary button text |
| `--color-focus` | `#b0ffbf` | Two-pixel keyboard outline |
| `--color-warning` | `#f0c989` | Paused/unavailable states and payment cautions |
| `--color-error` | `#ffaba4` | Invalid fields and recoverable errors |

Status always includes words or an icon. The status marker is never the only indication. Hover styles are gated by `(hover: hover)`. Selection uses the accent fill and on-accent text. Forced-colors mode uses system `Highlight`, `CanvasText` and `ButtonText` for focus and control boundaries. Measured contrast evidence belongs to [`artifacts/validation.md`](artifacts/validation.md).

## Typography

`IBM Plex Mono`, `'Courier New'`, `monospace` is the single UI stack. Three local Latin WOFF2 files in `public/fonts/` supply normal weights **400, 500 and 600**. Body text uses 400, labels/section headings use 500, and the main heading/primary action use 600. The font license is retained in `licenses/IBM-Plex-Mono.txt`.

| Token | Normal size | Use |
| --- | --- | --- |
| `--text-xs` | 12px / `.75rem` | Hints, data labels, small utilities |
| `--text-sm` | 14px / `.875rem` | Body and most control text |
| `--text-base` | 16px / `1rem` | All editable fields, primary actions, tertiary headings |
| `--text-heading` | 20px / `1.25rem` | Section/dialog headings and wordmark |
| `--text-title-small` | 32px / `2rem` | Mobile h1 |
| `--text-title` | 48px / `3rem` | Expanded h1 |

Body and hints use a unitless 1.6 line height; controls use 1.5; h2/h3 use 1.4; h1 uses 1.1. Heading tracking is `-.055em` on the expanded title, `-.045em` on the mobile title and `-.03em` on h2. Other text uses natural tracking. Headings use balanced wrapping; prose uses pretty wrapping. Numeric data uses tabular digits.

Inputs stay at 16px at normal text size, including phones. Critical addresses, request IDs, hashes, URIs and review amounts wrap with `overflow-wrap: anywhere`; no ellipsis hides those values. The connected account control uses a conventional short address and opens a dialog containing the complete value. Supporting copy is short and compact because this is a terminal-like task interface, rather than long-form reading.

The amount field starts empty. Its `0.00` placeholder illustrates decimal formatting; a payment must be entered or obtained with Estimate. That short hint stays readable in forced-colors mode without competing with the ETH suffix.

## Layout

The shared spacing tokens are **4, 8, 12, 16, 24, 32 and 48px**, expressed as rem values. `main` and `.header-inner` have a 1200px maximum width, including 32px inline gutters in the expanded layout. The footer's 1136px maximum aligns with that inner content edge.

`.product-grid` uses `minmax(0, 1.65fr) minmax(0, 1fr)` with a 48px gap. The leading workspace contains navigation and the form. The sidebar contains the exact contract address, real read state, payment explanation and disclosures. `.workspace` is one structured surface; its fields and sections are not nested cards.

| Breakpoint | Implemented behavior |
| --- | --- |
| At most `68rem` / 1088px | Grid becomes 1.5:1 with a 32px gap; workspace padding becomes 24px |
| At most `52rem` / 832px | Workspace and sidebar stack; sidebar uses two columns; binary illustration and wordmark suffix disappear |
| At most `40rem` / 640px | Wallet dialog becomes a full-width bottom sheet with safe-area padding and at least 52px rows |
| At most `36rem` / 576px | 16px gutters and workspace padding; 72px header minimum; 32px h1; 52px navigation minimum; sidebar and footer stack; general dialogs receive 12px viewport margins |

The header, navigation items and amount controls can wrap when text grows. The amount field has a flexible 10rem basis; Estimate moves to another row when needed. Form labels, long data and errors grow vertically. The header and main action stay in document flow. The small-screen primary review action is visible in the first 390×844 screen; its measured position and screenshots are in validation.

Observed layouts include 320, 390, 768 and 1440 CSS pixels, a wrong-network header at those widths, a 200% root-text enlargement at 390, and the purchase dialog at 320/390/1440. Text enlargement is distinct from browser-native zoom, which was not performed.

## Elevation & Depth

The interface is deliberately flat. Borders express fields, divisions and selection; there are no box shadows. A dialog uses a solid surface, a one-pixel border and a black backdrop at 80% opacity. Native `showModal()` supplies the top layer and an inert background. Its content can scroll within viewport bounds, using `vh` with `dvh` overrides. A small wallet-switch error popover sits above header content; the skip link is raised only when focused.

## Shapes

`--radius: 2px` is used on controls and dialogs. Workspace divisions remain square. Icons are a single local outline set in [`Icon.tsx`](src/components/Icon.tsx), normally 20px with a 1.5px stroke, `currentColor`, and decorative ARIA treatment. The terminal brand mark uses a 28px icon with a 2px stroke. Wallet marks preserve their vendor colors and are displayed at 28px.

## Components

- **Buttons and fields:** `.button` is a neutral outlined action; `.primary-button` is the sole filled action on the active surface; `.icon-button` and `.text-button` are utilities. General buttons have a 48px minimum height, the purchase review action 56px, and icon utilities 44px. Focus uses a two-pixel outline with a four-pixel offset; workspace navigation places its outline inside its edge. Loading labels describe the active operation, and controls prevent duplicate submissions while pending.
- **Purchase:** [`Purchase.tsx`](src/components/Purchase.tsx) owns the labeled brief, byte count, amount, estimate, fresh quote, confirmation and inline errors. `live`, `readError`, `reading`, `refresh`, `onSubmitted` and `pending` connect it to contract reads and receipt state. Invalid submissions focus the first invalid field and bind errors through `aria-describedby`/`aria-invalid`. The review displays exact amounts and the public/nonrefundable nature of payment. A stale cached price is labeled “Last read service price.”
- **Modal:** [`Modal.tsx`](src/components/Modal.tsx) accepts `title`, `onClose`, `children` and optional `className`. It uses native dialog semantics, explicit first/last Tab wrapping, Escape and backdrop dismissal, a labeled close control, and focus restoration. Nested wallet and purchase dialogs retain the correct background scroll lock.
- **Wallet:** [`Wallet.tsx`](src/wallet/Wallet.tsx) exports `WalletProvider`, `WalletControl` and `useOpenWallet`. The header control opens the wallet/account sheet or switches an unsupported chain. Rows represent discovered extensions, mobile wallet links or Coinbase. Pending and declined connections remain recoverable. `open-in.ts` constructs vendor URLs from the current page, including gateway subpaths and request hashes.
- **Tracking:** [`TrackRequest.tsx`](src/components/TrackRequest.tsx) uses a labeled lookup field and request/transaction modes. Pending, done, failed, missing and read-error states name the actual result. A stable live region carries updates. Results display full values and safe external URLs. Recent items are explicitly labeled “Saved in this browser.”
- **Copy utility:** [`CopyButton.tsx`](src/components/CopyButton.tsx) copies the complete supplied value, has an accessible name, reports success through an icon and live text, and gives a manual-copy fallback when clipboard access fails.
- **Disclosures:** Native `details`/`summary` in `App.tsx` reveal payment terms and contract provenance without crowding the first screen. The chevron changes direction when open.

The only interactive transitions are 120ms color/background/border changes inside `prefers-reduced-motion: no-preference`. Reduced motion disables them. There are no autoplaying effects or timers used as decorative animation; quote expiry and request refresh are functional state updates.

## Do's and Don'ts

- Reuse the semantic tokens, six-size type scale, existing field patterns and one active primary fill.
- Keep the working control before supporting explanations. Start a related surface with `.workspace` or the existing sidebar section pattern.
- Preserve full financial and contract values. Use the existing formatters for display and BigInt for on-chain amounts.
- Keep errors beside their control and name a recovery action. Distinguish cached reads, pending transactions and completed requests.
- Add no extra font, glow, gradient text, fabricated telemetry, card stack or continuous rain effect to this design.
- For another hash-routed view, retain the shared header, gutters, wallet provider, native modal behavior and source tokens. Keep its contract behavior in the existing configuration/client layer, and recheck its narrow and enlarged-text layouts.
