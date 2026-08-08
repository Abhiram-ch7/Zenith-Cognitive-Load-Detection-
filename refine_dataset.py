import pandas as pd

df = pd.read_csv("final_dataset.csv")

# Basic cleaning
df = df.dropna()
df = df[df["key_count"] > 5]

# Split
low = df[df["cognitive_load"] == "low"]
high = df[df["cognitive_load"] == "high"]

print("Before → LOW:", len(low), "HIGH:", len(high))

# -------------------------------
# VERY SAFE FILTERS
# -------------------------------

# LOW (keep most data, only remove extreme noise)
low = low[
    (low["avg_pause"] < 2.0)
]

# HIGH (only ensure some pause exists)
high = high[
    (high["avg_pause"] > 0.2)
]

print("After → LOW:", len(low), "HIGH:", len(high))

# -------------------------------
# SAFETY CHECK
# -------------------------------
if len(low) < 30 or len(high) < 30:
    print("⚠ Not enough data — skipping filtering")
    df_final = df
else:
    # Balance
    min_size = min(len(low), len(high))
    low = low.sample(min_size, random_state=42)
    high = high.sample(min_size, random_state=42)
    df_final = pd.concat([low, high])

# Shuffle
df_final = df_final.sample(frac=1, random_state=42)

# Save
df_final.to_csv("final_dataset_cleaned.csv", index=False)

print("Saved cleaned dataset")