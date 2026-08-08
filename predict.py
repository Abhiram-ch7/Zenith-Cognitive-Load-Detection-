import pandas as pd
import time
from pynput import keyboard
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler

# -------------------------------
# LOAD DATA & TRAIN MODEL
# -------------------------------
df = pd.read_csv("final_dataset.csv")

features = [
    "typing_speed",
    "avg_pause",
    "max_pause",
    "min_pause",
    "pause_variance",
    "key_count",
    "burst_typing",
    "long_pause_count",
    "pause_ratio"
]

X = df[features]
y = df["cognitive_load"]

# Normalize
scaler = StandardScaler()
X = scaler.fit_transform(X)

# Train model
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=15,
    random_state=42
)
model.fit(X, y)

# -------------------------------
# COLLECT REAL TYPING DATA
# -------------------------------
timestamps = []
error_count = 0

def on_press(key):
    global error_count
    timestamps.append(time.time())
    
    # Count backspace as error
    if key == keyboard.Key.backspace:
        error_count += 1

listener = keyboard.Listener(on_press=on_press)

print("\nStart typing for 10 seconds...")

listener.start()
time.sleep(10)
listener.stop()

# -------------------------------
# FEATURE EXTRACTION
# -------------------------------
key_count = len(timestamps)

if key_count < 2:
    print("Not enough typing data")
    exit()

pauses = []
for i in range(1, len(timestamps)):
    pauses.append(timestamps[i] - timestamps[i-1])

typing_speed = key_count / 10

avg_pause = sum(pauses) / len(pauses)
max_pause = max(pauses)
min_pause = min(pauses)

pause_variance = sum([(p - avg_pause)**2 for p in pauses]) / len(pauses)

# Extra features
burst_typing = key_count / (avg_pause + 0.001)
long_pause_count = sum(1 for p in pauses if p > 1)
pause_ratio = avg_pause / (max_pause + 0.001)


# -------------------------------
# PREPARE INPUT
# -------------------------------
input_data = [[
    typing_speed,
    avg_pause,
    max_pause,
    min_pause,
    pause_variance,
    key_count,
    burst_typing,
    long_pause_count,
    pause_ratio
]]

input_data = scaler.transform(input_data)

# -------------------------------
# PREDICTION
# -------------------------------
prediction = model.predict(input_data)[0]

# -------------------------------
# OUTPUT
# -------------------------------
print("\n--- Real Analysis ---")
print("Typing speed:", round(typing_speed, 2))
print("Avg pause:", round(avg_pause, 3))
print("Errors (backspace):", error_count)

print("\n Prediction:", prediction)