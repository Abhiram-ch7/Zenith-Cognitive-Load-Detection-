# ============================================================
# DL_predict.py  —  Real-time cognitive load prediction
#
# LABEL CONVENTION (matches training):
#   Model output > 0.5  →  HIGH cognitive load  (slow typing)
#   Model output < 0.5  →  LOW  cognitive load  (fast typing)
# ============================================================

import numpy as np
import time
from pynput import keyboard
from tensorflow.keras.models import load_model

WINDOW_SIZE = 30
RECORD_SECONDS = 15    # slightly longer window gives more keystrokes

# -------------------------------
# RECORD KEYSTROKES
# -------------------------------
timestamps = []

def on_press(key):
    timestamps.append(time.time())

listener = keyboard.Listener(on_press=on_press)

print(f"\nStart typing for {RECORD_SECONDS} seconds...")
print("(type naturally — the more you type, the better the prediction)\n")

listener.start()
time.sleep(RECORD_SECONDS)
listener.stop()

print(f"\nCaptured {len(timestamps)} keystrokes.")

# -------------------------------
# BUILD PAUSES
# -------------------------------
if len(timestamps) < 5:
    print("Not enough typing data. Please type more next time.")
    exit()

pauses = []
for i in range(1, len(timestamps)):
    p = timestamps[i] - timestamps[i - 1]
    # Filter out unrealistic gaps (e.g. user stopped for a long time)
    if 0 < p < 10:
        pauses.append(p)
    else:
        pauses.append(0.0)

if len(pauses) < 5:
    print("Not enough valid pauses detected.")
    exit()

# -------------------------------
# BUILD SEQUENCE (match training format)
# -------------------------------

if len(pauses) >= WINDOW_SIZE:
    # Use the most recent WINDOW_SIZE pauses
    recent_pauses = pauses[-WINDOW_SIZE:]
else:
    # Pad at the START with the mean pause (better than zeros)
    mean_pause = sum(pauses) / len(pauses)
    padding_needed = WINDOW_SIZE - len(pauses)
    recent_pauses = [mean_pause] * padding_needed + pauses

# Build [pause, speed] feature pairs
seq = []
for pause in recent_pauses:
    pause = float(pause)
    speed = float(1.0 / (pause + 1e-3))
    seq.append([pause, speed])

# Convert to numpy array with shape (1, 30, 2)
X = np.array([seq], dtype="float32")

# -------------------------------
# NORMALIZE  (same as training)
# -------------------------------
X[:, :, 0] = X[:, :, 0] / 5.0      # pause
X[:, :, 1] = X[:, :, 1] / 100.0    # speed

# -------------------------------
# LOAD MODEL & PREDICT
# -------------------------------
try:
    model = load_model("lstm_model.h5")
except Exception as e:
    print(f"Could not load model: {e}")
    print("Make sure lstm_model.h5 exists (run lstm_model.py first).")
    exit()

raw_output = model.predict(X, verbose=0)[0][0]

# -------------------------------
# USEFUL STATS FOR DEBUGGING
# -------------------------------
avg_pause   = sum(pauses) / len(pauses)
typing_speed = len(timestamps) / RECORD_SECONDS

print("\n--- Typing Stats ---")
print(f"  Keystrokes     : {len(timestamps)}")
print(f"  Typing speed   : {typing_speed:.2f} keys/sec")
print(f"  Average pause  : {avg_pause*1000:.0f} ms")
print(f"  Pauses used    : {len(recent_pauses)}")
print(f"  Raw model output: {raw_output:.4f}")

if avg_pause < 0.15:
    print("  (detected: fast typing)")
elif avg_pause < 0.40:
    print("  (detected: medium typing)")
else:
    print("  (detected: slow/hesitant typing)")
# -------------------------------
# FINAL PREDICTION
# -------------------------------
print("\n--- Prediction ---")
if raw_output > 0.5:
    confidence = raw_output * 100
    print(f"  HIGH Cognitive Load  (confidence: {confidence:.1f}%)")
    print("  (slow / hesitant typing detected)")
else:
    confidence = (1 - raw_output) * 100
    print(f"  LOW Cognitive Load   (confidence: {confidence:.1f}%)")
    print("  (fast / fluent typing detected)")