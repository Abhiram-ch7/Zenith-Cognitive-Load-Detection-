# Data Notice

## Why the raw logs aren't here

`logger.py` writes `str(key)` for every key press. That means the original
collection logs (`low.csv`, `high.csv`, `low1.csv`, `interaction_data.csv`, and the
merged `raw_data.csv`) recorded the literal characters typed during those sessions —
anything typed while the logger ran, including text that was never meant to be shared.

Those files are listed in `.gitignore` and are not part of this repository.

## What's published instead

`data/` contains redacted copies of the collection logs:

| File | Rows | Key presses redacted |
|---|---|---|
| `data/low.csv` | 3,350 | 2,426 |
| `data/high.csv` | 10,123 | 5,454 |
| `data/low1.csv` | 8,105 | 2,650 |
| `data/interaction_data.csv` | — | 2,085 |

Every printable single-character value (`'h'`, `'7'`, …) is rewritten as `'x'`.
Left untouched:

- `timestamp` — the entire basis of every feature
- `event_type` — `key_press`, `mouse_move`, `mouse_click`
- `Key.*` names — `Key.space`, `Key.backspace`, `Key.enter`, etc. These are
  special-key identifiers rather than typed content, and `clean_data.py` filters
  on them directly, so they have to survive.
- mouse coordinates — screen positions, not content

## Why this loses nothing

No stage of the pipeline reads the identity of a typed character:

- `clean_data.py` tests `value` only against `Key.alt_l`, `Key.tab`, `Key.ctrl_l`,
  `Key.shift` — all preserved.
- `feature_extractor.py` uses `timestamp` and `event_type` and never touches `value`.
- `DL_converterasd.py` uses `timestamp` alone.

Verified empirically by running `extract_features` over both the original and
redacted logs:

```
low:  50 windows from raw, 50 from redacted -> identical=True
high: 70 windows from raw, 70 from redacted -> identical=True
```

The redacted logs regenerate `final_dataset.csv` exactly.

## Reproducing the redaction

`sanitize_logs.py` reads `low.csv`, `high.csv`, `low1.csv` from the project root
and writes redacted copies into `data/`:

```bash
python sanitize_logs.py
```
