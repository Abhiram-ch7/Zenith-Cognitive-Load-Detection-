# ============================================================
# DL_converter.py  —  creates X.npy and y.npy for testing
# LABEL CONVENTION (must match lstm_model.py):
#   low.csv  = slow typing = HIGH cognitive load = label 1
#   high.csv = fast typing = LOW  cognitive load = label 0
# ============================================================

import pandas as pd
import numpy as np


def create_sequences(data, label_value):
    timestamps = data["timestamp"].values

    pauses = []
    for i in range(1, len(timestamps)):
        p = timestamps[i] - timestamps[i - 1]
        pauses.append(p if 0 < p < 10 else 0.0)

    window_size = 30
    step_size = 10

    sequences = []
    labels = []

    for i in range(0, len(pauses) - window_size, step_size):
        seq = []
        for j in range(window_size):
            pause = float(pauses[i + j])
            speed = float(1.0 / (pause + 1e-3))
            seq.append([pause, speed])
        sequences.append(seq)
        labels.append(label_value)

    return sequences, labels


# -------------------------------
# LOAD RAW DATA
# -------------------------------
low_df  = pd.read_csv("low.csv")
high_df = pd.read_csv("high.csv")

# Rename columns if needed
for df in [low_df, high_df]:
    if df.columns[0].lower() not in ["timestamp"]:
        df.columns = ["timestamp", "event", "key"]

low_df["timestamp"]  = pd.to_numeric(low_df["timestamp"],  errors="coerce")
high_df["timestamp"] = pd.to_numeric(high_df["timestamp"], errors="coerce")

low_df  = low_df.dropna(subset=["timestamp"]).sort_values("timestamp")
high_df = high_df.dropna(subset=["timestamp"]).sort_values("timestamp")

# LABEL: low=1 (HIGH load), high=0 (LOW load)
low_seq,  low_labels  = create_sequences(low_df,  label_value=1)   # HIGH load
high_seq, high_labels = create_sequences(high_df, label_value=0)   # LOW load

all_seq    = low_seq + high_seq
all_labels = low_labels + high_labels

X = np.array(all_seq,    dtype="float32")
y = np.array(all_labels, dtype="float32")

# Normalize — same as training
X[:, :, 0] = X[:, :, 0] / 5.0
X[:, :, 1] = X[:, :, 1] / 100.0

np.save("X.npy", X)
np.save("y.npy", y)

print("DL dataset created")
print(f"Shape: {X.shape}")
print(f"HIGH load samples (label=1): {int(sum(y==1))}")
print(f"LOW  load samples (label=0): {int(sum(y==0))}")
