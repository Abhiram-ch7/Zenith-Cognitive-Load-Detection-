# ============================================================
# lstm_model.py
# LABELS:
#   low.csv  = fast typing = LOW  cognitive load = 0
#   high.csv = slow typing = HIGH cognitive load = 1
# ============================================================

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.utils import resample
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping


def process_file(file, label_value):
    try:
        df = pd.read_csv(file)
        if df.columns[0].lower() != "timestamp":
            raise ValueError
    except:
        df = pd.read_csv(file, header=None)
        df.columns = ["timestamp", "event", "key"]

    df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")
    df = df.dropna().sort_values(by="timestamp")
    timestamps = df["timestamp"].values

    pauses = []
    for i in range(1, len(timestamps)):
        pause = timestamps[i] - timestamps[i - 1]
        pauses.append(pause if 0 < pause < 10 else 0)

    window_size = 30
    step_size   = 5   # smaller step = more sequences from same data

    sequences = []
    for i in range(0, len(pauses) - window_size, step_size):
        seq = []
        for j in range(window_size):
            pause = float(pauses[i + j])
            speed = float(1.0 / (pause + 0.001))
            seq.append([pause, speed])
        sequences.append((seq, label_value))

    return sequences


# low.csv  = fast typing = LOW  load = 0
# high.csv = slow typing = HIGH load = 1
low_data  = process_file("low.csv",  label_value=0)
high_data = process_file("high.csv", label_value=1)

print(f"Before balancing — LOW: {len(low_data)}, HIGH: {len(high_data)}")

# ============================================================
# OVERSAMPLE minority class so model sees equal amounts
# ============================================================
if len(low_data) > len(high_data):
    high_data = resample(high_data,
                         replace=True,
                         n_samples=len(low_data),
                         random_state=42)
else:
    low_data = resample(low_data,
                        replace=True,
                        n_samples=len(high_data),
                        random_state=42)

print(f"After balancing  — LOW: {len(low_data)}, HIGH: {len(high_data)}")

all_data = low_data + high_data
np.random.shuffle(all_data)

X = np.array([d[0] for d in all_data], dtype="float32")
y = np.array([d[1] for d in all_data], dtype="float32")

# Normalize
X[:, :, 0] = X[:, :, 0] / 5.0
X[:, :, 1] = X[:, :, 1] / 100.0

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"Training samples : {len(X_train)}")
print(f"Testing  samples : {len(X_test)}")

# Build model
model = Sequential([
    LSTM(64, input_shape=(30, 2), return_sequences=True),
    Dropout(0.3),
    LSTM(32),
    Dropout(0.2),
    Dense(16, activation="relu"),
    Dense(1,  activation="sigmoid")
])

model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])

early_stop = EarlyStopping(monitor="val_loss", patience=7, restore_best_weights=True)

history = model.fit(
    X_train, y_train,
    epochs=80,
    batch_size=32,
    validation_split=0.2,
    callbacks=[early_stop],
    verbose=1
)

loss, acc = model.evaluate(X_test, y_test, verbose=0)
print(f"\nTest Accuracy: {acc * 100:.2f}%")

model.save("lstm_model.h5")
print("Saved as lstm_model.h5")