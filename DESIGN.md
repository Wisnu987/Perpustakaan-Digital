# Design System — Smart Library SMP Negeri 1 Dramaga

## Visual Identity ("Dramaga Spruce & Mineral Paper")

- **Mode**: Operate (Institutional school library & relational database demo workspace).
- **Layout Shell**:
  - Desktop (`>= 1024px`): Two-column grid (`248px` sticky left rail + fluid workspace column).
  - Tablet / Mobile (`< 1024px`): Single-column workspace with sticky topbar and fixed bottom navigation bar (5 tabs).
- **Signature Move**: Unified Ledger Ribbon (`.ledger-ribbon`) on `#view-circulation` — a single continuous white surface split by hairline vertical dividers (`1px solid var(--border-subtle)`) with a CSS-styled native `<progress>` bar (`#stat-stock-progress`) tracking available vs. total inventory ratio.

## Typography

- **Primary Sans**: `Figtree` (`400`, `500`, `600`, `700`), self-hosted variable `.woff2` subsets in `assets/fonts/`.
- **Monospace**: `Fira Mono` (`400`, `500`, `700`), self-hosted `.woff2` subsets in `assets/fonts/` with `font-variant-numeric: tabular-nums` on IDs, dates, counts, ISBNs, and SQL previews.
- **Scale Floor**: All UI text, table headers, badges, and helper labels stay `>= 0.8125rem` (`13px`), headings use fixed `rem` scale (`1.375rem` page title, `1rem` section/dialog titles).

## Color Palette

### Light Theme (`[data-theme="light"]`)
- **Shell Rail**: `#13312A` (background), `#1B4339` (hover), `#215246` (active), `#EAF4F0` (text), `#A9CBC0` (muted), `#8BE0B8` (accent icon).
- **Workspace Surfaces**: `#F3F6F4` (canvas), `#FFFFFF` (surface), `#E9F0EC` (subtle), `#E2ECE7` (hover).
- **Text & Borders**: `#10211C` (primary), `#334C45` (secondary), `#526A63` (muted), `#D5E0DA` (subtle border), `#B2C5BC` (strong border).
- **Primary Action**: `#146350` (`#0F4F40` hover, `#E3F3EE` soft tint).
- **Semantic Status**:
  - Info (`Dipinjam` / `Siswa`): `#1E4B8A` on `#EBF2FC`
  - Success (`Tersedia` / `Selesai` / `Lunas`): `#136B48` on `#E6F6EE`
  - Warning (`Rusak`): `#9A5808` on `#FEF4E5`
  - Danger (`Terlambat` / `Hilang` / `Belum Lunas`): `#B42318` on `#FEECEB`

### Dark Theme (`[data-theme="dark"]`)
- **Shell Rail**: `#0B1815` (background), `#132924` (hover), `#193730` (active), `#ECF5F2` (text).
- **Workspace Surfaces**: `#0F1917` (canvas), `#152320` (surface), `#1C2E2A` (subtle), `#223833` (hover).
- **Primary Action**: `#1A7D62` (`#209475` hover).

## Components & Craft Rules

- **Borderless Sheet Tables (`.sheet` > `.table-wrap` > `.data-table`)**: Outer `.sheet` container carries `14px 18px` padding and `1px solid var(--border-subtle)` so table headers/cells sit cleanly inset without edge crowding.
- **No Nested Cards**: Forms and Mission Objectives use flat hairline dividers (`.panel-section`, `.mo-item`) rather than boxed cards inside cards.
- **Strict CSP Compatibility**: Zero inline `style="..."` or `onclick="..."`; all dynamic interactions use delegated `[data-action]` handlers and CSS classes.
