# PTO visual QA

## Evidence collected in this night run

- TypeScript passed.
- Vitest passed: 9 files / 30 tests.
- Production Vite build passed.
- The build reports an unresolved `/grid.svg` runtime URL, one ineffective
  dynamic import, and chunks above 500 KB.
- A safe PTO workflow sidebar/mobile navigation was added to `TestShell.tsx`.
- No authenticated browser session was available and no browser screenshots or
  runtime visual smoke were captured.

## Required viewport matrix

| Viewport | Required checks | Status |
|---|---|---|
| 1920×1080 | sidebar, tree, inspector, dense tables, no page overflow | NOT RUN |
| 1366×768 | context bar and first-row actions remain visible | NOT RUN |
| ~1024 tablet/desktop | horizontal table scroll stays local | NOT RUN |
| narrow mobile | workflow nav scrolls; essential selection/action remains usable | NOT RUN |

## Screen checklist

### Portfolio / object

- company change revalidates object;
- object ID is visible and survives refresh;
- empty, stale and forbidden states differ;
- no fabricated total.

### Smeta / LRV / RES

- tree virtualizes large data;
- search and expand state are usable;
- source sheet/row evidence is reachable;
- wide columns scroll inside the table.

### Fakt / F2

- quantity, unit, price and amount remain distinct;
- negative correction is visible;
- draft/approved/history states are visually distinct;
- import progress and resumability are real.

### Zayavka / AOSR / documents

- context pre-fills object/resource without retyping;
- upload and readback show ownership and hash/status;
- AI extraction remains a reviewable draft;
- every disabled placeholder explains why it is unavailable.

## Known visual risks from source inspection

- `TestFakt` has dense fixed columns and non-wrapping header controls.
- `TestSklad` contains fixed-width search and a qoldiq table needing local
  overflow review; QR, M-29 and history controls are unfinished.
- `TestFaktura` uses a fixed-width object selector.
- Object context is screen-local in Fakt, Sklad, Faktura and Zayavka.

## Next visual run

Start the local frontend, use a seeded non-production session or approved
owner session, capture each viewport, test direct URLs/refresh/context switch,
and attach screenshots only after verifying they contain no confidential data.
