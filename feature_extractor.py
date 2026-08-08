import pandas as pd

def extract_features(file_path, label):
    df = pd.read_csv(file_path)
    df["timestamp"] = df["timestamp"].astype(float)

    features = []
    window_size = 5

    start = 0
    max_time = df["timestamp"].max()

    while start < max_time:
        end = start + window_size
        window = df[(df["timestamp"] >= start) & (df["timestamp"] < end)]

        key_events = window[window["event_type"] == "key_press"]
        key_count = len(key_events)

        # Remove weak data
        if key_count > 5:
            timestamps = key_events["timestamp"].values

            pauses = []
            for i in range(1, len(timestamps)):
                pauses.append(timestamps[i] - timestamps[i-1])

            avg_pause = sum(pauses) / len(pauses)
            max_pause = max(pauses)
            min_pause = min(pauses)

            pause_variance = sum([(p - avg_pause)**2 for p in pauses]) / len(pauses)

            typing_speed = key_count / window_size

            #  NEW FEATURES
            burst_typing = key_count / (avg_pause + 0.001)
            long_pause_count = sum(1 for p in pauses if p > 1)
            pause_ratio = avg_pause / (max_pause + 0.001)

            features.append([
                typing_speed,
                avg_pause,
                max_pause,
                min_pause,
                pause_variance,
                key_count,
                burst_typing,
                long_pause_count,
                pause_ratio,
                label
            ])

        start += window_size

    return features


low_data = extract_features("low.csv", "low")
high_data = extract_features("high.csv", "high")

all_data = low_data + high_data

df = pd.DataFrame(all_data, columns=[
    "typing_speed",
    "avg_pause",
    "max_pause",
    "min_pause",
    "pause_variance",
    "key_count",
    "burst_typing",
    "long_pause_count",
    "pause_ratio",
    "cognitive_load"
])

df.to_csv("final_dataset.csv", index=False)

print(" Feature extraction complete!")