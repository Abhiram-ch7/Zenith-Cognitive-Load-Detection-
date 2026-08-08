# 🧠 Zenith — Cognitive Load Detection from Typing Behaviour

Detecting a person's cognitive load from **how** they type — never **what** they type.

Zenith pairs a machine-learning pipeline (RandomForest + LSTM) with an Electron desktop
companion that watches typing rhythm in real time and offers a short, well-timed
intervention when it detects overload.

> Academic project — Amrita, Semester 2, AI/ML.

---

## What it does

Typing rhythm changes measurably under mental strain: pauses lengthen and grow
irregular, bursts get shorter, error rates climb. Zenith captures those timing
signals, turns them into features, and classifies the session as **low** or **high**
cognitive load.

Two models are trained on the same data:

| Model | Input | Where it lives |
|---|---|---|
| **RandomForest** | 9 aggregate features over a 5-second window | `train_model.py` |
| **LSTM** | 30-step sequence of `(pause, speed)` pairs | `lstm_modelasd.py` |

The nine features: `typing_speed`, `avg_pause`, `max_pause`, `min_pause`,
`pause_variance`, `key_count`, `burst_typing`, `long_pause_count`, `pause_ratio`.

---

## Pipeline

```
logger.py            collect raw keystroke timings  ->  low.csv / high.csv
   |
clean_data.py        drop modifier keys, bad rows   ->  *_cleaned.csv
   |
feature_extractor.py 5s sliding windows -> 9 features -> final_dataset.csv
   |
   +-- train_model.py      RandomForest, accuracy + confusion matrix
   +-- refine_dataset.py   balance + filter -> final_dataset_cleaned.csv
   +-- predict.py          live 10-second prediction on your own typing
   |
DL_converterasd.py   sequence windows            ->  X.npy / y.npy
   |
   +-- lstm_modelasd.py     train the LSTM       ->  lstm_model.h5
   +-- lstm_model_h5asd.py  spot-check 10 random samples
   +-- DL_predictasd.py     live LSTM prediction
```

`combine_raw.py` merges the two labelled logs into `raw_data.csv`, and `diagonse.py`
prints dataset diagnostics.

---

## The desktop app

`zenith-app/` is an Electron companion that runs the same detection logic in
JavaScript, so it needs no Python at runtime.

```bash
cd zenith-app
npm install
npm start
```

It scores typing rhythm across six weighted factors, smooths the result
(exponential, α = 0.3) to suppress noise, and classifies into
`calm → focused → stressed → overloaded`. On overload it surfaces one of nine
interventions — guided breathing, micro-break, ambient sound, task chunking,
stretches, focus reset, reflection prompt, screen dim, posture check.

See [zenith_architecture.md](zenith_architecture.md) for the full architecture,
design system, and module breakdown, and
[zenith-app/zenith_documentation.md](zenith-app/zenith_documentation.md) for app docs.

**Privacy by design:** the app analyses inter-key intervals only. No keystroke
content is stored, nothing is sent off the machine, and monitoring can be paused
at any time.

---

## Running the ML pipeline

```bash
pip install -r requirements.txt
```

The raw logs are redacted (see below) and live in `data/`. Copy them into the
project root before running the pipeline:

```bash
cp data/*.csv .
```

Then:

```bash
python feature_extractor.py
python train_model.py
```

To try a live prediction on your own typing (10 seconds):

```bash
python predict.py
```

---

## Data & privacy

`logger.py` records `str(key)` for every press, so the original collection logs
contained the literal characters typed during those sessions. **Those raw files are
not published.** `data/` holds redacted copies with every printable character
rewritten as `'x'`; timestamps, event types, and `Key.*` names are untouched.

Nothing downstream reads character identity — `clean_data.py` filters only on
`Key.*` names and `feature_extractor.py` uses `timestamp` and `event_type` alone —
so the redacted logs reproduce the exact same feature rows. This was verified:
50/50 low windows and 70/70 high windows match the originals identically.

`sanitize_logs.py` is the script that performs the redaction. Details in
[DATA_NOTICE.md](DATA_NOTICE.md).

---

## Repository layout

| Path | Contents |
|---|---|
| `data/` | Redacted keystroke logs |
| `final_dataset.csv` | 9 features per 5s window, labelled |
| `sequence_dataset.csv` | Sequence windows for the LSTM |
| `X.npy` / `y.npy` | Prepared LSTM tensors |
| `lstm_model.h5`, `lstm_model_v2.h5` | Trained LSTM weights |
| `zenith-app/` | Electron desktop companion |
| `zenith_architecture.md` | System architecture & design system |
| `Project.pdf` | Project report |
| `AIML LITERATURE REVIEW (1).pdf` | Literature review |

---

## License

MIT — see [LICENSE](LICENSE).
