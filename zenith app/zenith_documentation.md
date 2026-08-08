# Zenith — Cognitive Wellness Assistant

Zenith is a cross-platform, privacy-first desktop application designed to monitor cognitive load, prevent burnout, and encourage deep work through intelligent tracking and timely interventions. 

This document outlines the core architecture, features, and the mathematical models driving the intelligent analysis.

---

## 1. System Architecture
- **Framework**: Built with **Electron** (HTML/CSS/JS frontend, Node.js backend).
- **Cross-Platform**: Natively supports Windows, macOS, and Linux from a single codebase.
- **Privacy-First**: Operates 100% locally. All data, including typing telemetry and daily stress logs, are saved to a local `.json` file via `electron-store`. No data is sent to the cloud.
- **Unobtrusive Execution**: Designed to run seamlessly in the background (System Tray) while continuously monitoring user activity without interrupting their workflow.

---

## 2. Core Features

### 🧠 Real-Time Cognitive Load Detection
Zenith continuously monitors user telemetry (such as keystroke dynamics, typing speed, backspace usage, and pause frequency) alongside active application context to calculate a real-time stress score. 

### 🛡️ Smart Interventions
When the system detects high cognitive load, it proactively suggests "Neural Breaks" and interventions to restore focus and reduce stress:
- **Focus Sprints & Focus Mode**: 25-minute deep-work sessions that minimize background windows and distractions.
- **Micro-Breaks & Screen Dimming**: Enforces a mental break by gently dimming the user's screen.
- **Audio Soundscapes**: Built-in ambient noise (Rain, Ocean, Forest) and Lofi Focus Radio to aid concentration.
- **Guided Recovery**: Breathing exercises, posture checks, and desk stretching routines.
- **Mindful Reflection**: Prompts the user to realign their priorities and chunk complex tasks.

---

## 3. Mathematical Formulas & Telemetry

Zenith relies on specific algorithms to translate raw computer usage into meaningful cognitive metrics.

### A. The Cognitive Load Formula
The core AI engine calculates a **Stress Score** ranging from `0.0` (Absolute Calm) to `1.0` (Maximum Overload). The score increases with erratic typing, high error rates (backspaces), long unnatural pauses, and the use of heavy/complex applications (like IDEs).

**State Thresholds:**
*   `Score > 0.70` ➔ **Overloaded** (Triggers immediate intervention)
*   `Score > 0.50` ➔ **Stressed** (Elevated cognitive load)
*   `Score > 0.30` ➔ **Focused** (Deep work state)
*   `Score ≤ 0.30` ➔ **Calm** (Relaxed or idle)

### B. Cognitive Debt (Min Debt)
Represents the amount of restorative break time the user "owes" their brain after periods of sustained focus. 

**Formula:**
```text
Cognitive Debt = Continuous Working Minutes × Cognitive Load Score × 0.5
```
*Example: If a user works for 60 minutes straight at a high cognitive load score of 0.80, their accrued debt is `60 * 0.8 * 0.5 = 24 minutes` of break time needed.*

### C. Flow Probability
A percentage indicating how likely the user is in a state of "Flow" (highly productive, focused work without frustration).

**Formula Components:**
1.  **Speed Score**: `Min(1.0, Typing Speed / 8 keys per sec)` — Normalizes speed.
2.  **Accuracy Score**: `1.0 - Min(1.0, Error Rate × 5)` — Heavily penalizes high backspace usage.

**Final Flow Formula:**
```text
Flow Probability = ( (Speed Score × 0.6) + (Accuracy Score × 0.4) ) × 100
```
*This weights raw typing speed at 60% and typing accuracy at 40%.*

---

## 4. Technology Stack Summary
*   **Electron Builder**: Packaging and installer generation.
*   **Keystroke Monitor**: Native or Node-based telemetry capture.
*   **HTML/CSS/JS Vanilla Stack**: High-performance, low-overhead UI rendering using modern CSS variables and glassmorphic aesthetics.
