import time
import csv
import os
from pynput import keyboard, mouse

# Ask session type
session_type = input("Enter session type (low / high): ").strip().lower()

if session_type not in ["low", "high"]:
    print("Invalid session type. Use 'low' or 'high'.")
    exit()

filename = f"{session_type}.csv"

file_exists = os.path.isfile(filename)

# Open file
file = open(filename, "a", newline="")
writer = csv.writer(file)

# Write header only if file is new
if not file_exists:
    writer.writerow(["timestamp", "event_type", "value"])
    file.flush()

print(f"Saving data to {filename}")

start_time = time.time()

# -------------------------------
# KEYBOARD EVENTS
# -------------------------------
def on_press(key):
    timestamp = time.time() - start_time
    writer.writerow([timestamp, "key_press", str(key)])
    file.flush()   #  ensures data is written instantly

# -------------------------------
# MOUSE MOVE
# -------------------------------
def on_move(x, y):
    timestamp = time.time() - start_time
    writer.writerow([timestamp, "mouse_move", f'"{x},{y}"'])
    file.flush()

# -------------------------------
# MOUSE CLICK
# -------------------------------
def on_click(x, y, button, pressed):
    if pressed:
        timestamp = time.time() - start_time
        writer.writerow([timestamp, "mouse_click", str(button)])
        file.flush()

# Start listeners
keyboard_listener = keyboard.Listener(on_press=on_press)
mouse_listener = mouse.Listener(on_move=on_move, on_click=on_click)

keyboard_listener.start()
mouse_listener.start()

print("Logging started... Press Ctrl+C to stop.")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Logging stopped.")
    file.close()