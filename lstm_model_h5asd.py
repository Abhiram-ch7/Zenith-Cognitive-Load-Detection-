# ============================================================
# lstm_model_h5.py  —  Test 10 random samples from X.npy/y.npy
# Run DL_converter_fixed.py first to regenerate X.npy / y.npy
# ============================================================

import numpy as np
from tensorflow.keras.models import load_model
import random

X = np.load("X.npy")
y = np.load("y.npy")

model = load_model("lstm_model.h5")

num_tests = 10
correct = 0

print(f"\nRUNNING {num_tests} TEST CASES:\n")

for i in range(num_tests):
    idx = random.randint(0, len(X) - 1)

    sample = X[idx:idx + 1]
    actual = int(y[idx])

    pred_prob = model.predict(sample, verbose=0)[0][0]
    pred = 1 if pred_prob > 0.5 else 0

    result = "CORRECT" if pred == actual else "WRONG"
    if pred == actual:
        correct += 1

    actual_label = "HIGH load" if actual == 1 else "LOW load"
    pred_label   = "HIGH load" if pred   == 1 else "LOW load"

    print(f"Test {i + 1}")
    print(f"  Actual   : {actual_label}")
    print(f"  Predicted: {pred_label}")
    print(f"  Raw score: {pred_prob:.3f}")
    print(f"  Result   : {result}")
    print("-" * 30)

accuracy = (correct / num_tests) * 100
print(f"\nFINAL RESULT: {correct}/{num_tests} correct  ({accuracy:.1f}%)")
