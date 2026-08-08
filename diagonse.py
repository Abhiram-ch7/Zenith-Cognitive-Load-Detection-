import numpy as np
import time
import pandas as pd
from pynput import keyboard

WINDOW_SIZE = 30
RECORD_SECONDS = 15

# -------------------------------
# RECORD KEYSTROKES
# -------------------------------
timestamps = []

def on_press(key):
    timestamps.append(time.time())

listener = keyboard.Listener(on_press=on_press)

print("\nStart typing FAST for 15 seconds...")
print("(type naturally at your normal speed)\n")

listener.start()
time.sleep(RECORD_SECONDS)
listener.stop()

print(f"Captured {len(timestamps)} keystrokes.")

# -------------------------------
# BUILD PAUSES
# -------------------------------
pauses = []
for i in range(1, len(timestamps)):
    p = timestamps[i] - timestamps[i - 1]
    if 0 < p < 10:
        pauses.append(p)

avg_pause   = sum(pauses) / len(pauses)
typing_speed = len(timestamps) / RECORD_SECONDS

print("\n--- YOUR LIVE TYPING ---")
print(f"  Speed       : {typing_speed:.2f} keys/sec")
print(f"  Avg pause   : {avg_pause*1000:.0f}ms")
print(f"  Long pauses : {sum(1 for p in pauses if p > 0.4)}")

# -------------------------------
# COMPARE WITH TRAINING DATA
# -------------------------------
print("\n--- TRAINING DATA COMPARISON ---")

try:
    low  = pd.read_csv("low.csv")
    high = pd.read_csv("high.csv")

    for df, name in [(low, "low.csv (HIGH load)"), (high, "high.csv (LOW load)")]:
        df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")
        df = df.dropna().sort_values("timestamp")
        ts = df["timestamp"].values
        ps = [ts[i]-ts[i-1] for i in range(1, len(ts)) if 0 < ts[i]-ts[i-1] < 10]
        print(f"  {name}")
        print(f"    Avg pause : {np.mean(ps)*1000:.0f}ms  |  Speed: {1/np.mean(ps):.1f} keys/sec")
except:
    print("  Could not load CSV files - run this from your project folder")

# -------------------------------
# SHOW WHAT MODEL WILL SEE
# -------------------------------
print("\n--- DIAGNOSIS ---")

try:
    low  = pd.read_csv("low.csv")
    high = pd.read_csv("high.csv")
    low["timestamp"]  = pd.to_numeric(low["timestamp"],  errors="coerce")
    high["timestamp"] = pd.to_numeric(high["timestamp"], errors="coerce")
    low  = low.dropna().sort_values("timestamp")
    high = high.dropna().sort_values("timestamp")

    low_ts  = low["timestamp"].values
    high_ts = high["timestamp"].values

    low_ps  = [low_ts[i]-low_ts[i-1]   for i in range(1, len(low_ts))  if 0 < low_ts[i]-low_ts[i-1]  < 10]
    high_ps = [high_ts[i]-high_ts[i-1] for i in range(1, len(high_ts)) if 0 < high_ts[i]-high_ts[i-1] < 10]

    low_avg  = np.mean(low_ps)
    high_avg = np.mean(high_ps)

    if avg_pause < high_avg:
        print(f"  Your typing ({avg_pause*1000:.0f}ms) is FASTER than high.csv ({high_avg*1000:.0f}ms)")
        print("  Model should predict LOW load -- if it doesn't, model needs retraining")
    elif avg_pause < low_avg:
        print(f"  Your typing ({avg_pause*1000:.0f}ms) is between high.csv and low.csv")
        print("  Model result depends on training quality")
    else:
        print(f"  Your typing ({avg_pause*1000:.0f}ms) is SLOWER than low.csv ({low_avg*1000:.0f}ms)")
        print("  Your fast typing is still slower than training data!")
        print("  >> You need to re-record low.csv and high.csv with more realistic speeds")

except Exception as e:
    print(f"  Error: {e}")

print("\n--- RAW MODEL OUTPUT ---")
try:
    from tensorflow.keras.models import load_model

    if len(pauses) >= WINDOW_SIZE:
        recent = pauses[-WINDOW_SIZE:]
    else:
        mean_p = avg_pause
        recent = [mean_p] * (WINDOW_SIZE - len(pauses)) + pauses

    seq = [[float(p), float(1.0/(p+1e-3))] for p in recent]
    X = np.array([seq], dtype="float32")
    X[:,:,0] = X[:,:,0] / 5.0
    X[:,:,1] = X[:,:,1] / 100.0

    model = load_model("lstm_model.h5")
    raw = model.predict(X, verbose=0)[0][0]

    print(f"  Raw output  : {raw:.4f}")
    print(f"  Threshold   : 0.5")
    print(f"  Decision    : {'HIGH load' if raw > 0.5 else 'LOW load'}")

    if raw > 0.8:
        print("\n  >> Model is very confident HIGH -- training data is mismatched")
        print("  >> Re-record CSV files with realistic typing speeds")
    elif raw > 0.5:
        print("\n  >> Borderline HIGH -- lower threshold or retrain with more data")
    else:
        print("\n  >> Correctly predicting LOW load!")

except Exception as e:
    print(f"  Could not run model: {e}")

input("\nPress Enter to close...")