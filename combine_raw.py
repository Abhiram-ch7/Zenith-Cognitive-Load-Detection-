import pandas as pd

# Load raw typing logs (no headers)
low = pd.read_csv("low.csv", header=None)
low["cognitive_load"] = "low"

high = pd.read_csv("high.csv", header=None)
high["cognitive_load"] = "high"

# Combine both
df = pd.concat([low, high])

# Save
df.to_csv("raw_data.csv", index=False)

print(" raw_data.csv created")