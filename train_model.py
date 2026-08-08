import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from sklearn.preprocessing import StandardScaler

# Load dataset
df = pd.read_csv("final_dataset.csv")

# Balance
low_df = df[df["cognitive_load"] == "low"]
high_df = df[df["cognitive_load"] == "high"]

min_size = min(len(low_df), len(high_df))

df = pd.concat([
    low_df.sample(min_size, random_state=42),
    high_df.sample(min_size, random_state=42)
])

# Features (ORIGINAL BEST SET)
X = df[[
    "typing_speed",
    "avg_pause",
    "max_pause",
    "min_pause",
    "pause_variance",
    "key_count",
    "burst_typing",
    "long_pause_count",
    "pause_ratio"
]]

y = df["cognitive_load"]

# Normalize
scaler = StandardScaler()
X = scaler.fit_transform(X)

# Split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Model
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=15,
    min_samples_split=5,
    random_state=42
)

model.fit(X_train, y_train)

# Predict
y_pred = model.predict(X_test)

# Results
accuracy = accuracy_score(y_test, y_pred)

print("\n Model Accuracy:", round(accuracy * 100, 2), "%")

print("\n Classification Report:")
print(classification_report(y_test, y_pred))

print("\n Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))