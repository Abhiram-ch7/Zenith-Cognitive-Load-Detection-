"""
Produce shareable copies of the raw keystroke logs.

logger.py records str(key) for every key press, which means the raw CSVs contain
the literal characters typed during a collection session. This script rewrites
each printable character as 'x' while leaving timestamps, event types and the
Key.* special-key names untouched.

Nothing downstream reads the character identity: clean_data.py only filters on
the Key.* names, and feature_extractor.py uses timestamp and event_type alone.
So the redacted logs regenerate final_dataset.csv byte for byte.
"""

import csv
import os
import re

# A single-character key press, e.g. 'h' or '7'. Key.space, Key.backspace etc.
# are special-key names, not typed content, and are kept as-is.
CHAR_KEY = re.compile(r"^'.'$")

FILES = ["low.csv", "high.csv", "low1.csv", "interaction_data.csv"]
OUT_DIR = "data"


def redact(value):
    return "'x'" if CHAR_KEY.match(value) else value


def sanitize(src, dst):
    with open(src, newline="") as f_in, open(dst, "w", newline="") as f_out:
        writer = csv.writer(f_out)
        redacted = 0

        for row in csv.reader(f_in):
            # The value column is last; short/blank rows pass through untouched.
            if len(row) >= 3:
                original = row[2]
                row[2] = redact(original)
                if row[2] != original:
                    redacted += 1
            writer.writerow(row)

    print(f"{src} -> {dst} ({redacted} key presses redacted)")


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)

    for name in FILES:
        if os.path.isfile(name):
            sanitize(name, os.path.join(OUT_DIR, name))
        else:
            print(f"{name} not found, skipping")
