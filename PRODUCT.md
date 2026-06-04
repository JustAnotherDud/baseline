# Product

## Register

product

## Users

A single power user (José, "Dud") — an endurance runner who also lifts. He uses Baseline on his phone, one-handed, several times a day: logging food at meals, checking remaining macros against the day's target, reviewing training load and HRV from Intervals.icu, and tracking body composition synced from Garmin. He already understands his own metrics (CTL/ATL/TSB, macros in grams, kcal targets); he doesn't need them explained, he needs them legible at a glance and fast to act on. Context is real life: kitchen, gym, supermarket, in bed before sleep. Often distracted, often mid-task.

## Product Purpose

Baseline is a personal, single-user PWA that aggregates an athlete's nutrition, body composition, and training data into one mobile interface. Nutrition and body data live in Supabase; training metrics come live from the Intervals.icu API; daily macro targets are pushed by an external coaching process (the DCB) into `daily_targets`, which the app reads but never writes. Success is: the fastest possible food logging, an unambiguous read on "where am I against today's target," and a single place to glance at form/fatigue/HRV without opening four other apps. It replaces a stack of consumer apps with one instrument tuned to exactly his workflow.

## Brand Personality

Instrument panel. Precise, dense, data-forward, calm. Three words: **legible, exact, unfussy.** The voice is a cockpit gauge, not a cheerleader: numbers in monospace, tight uppercase mono labels, a single green accent that means "on target / primary action" and nothing decorative. No motivational copy, no gamification, no celebration animations. Portuguese (pt-PT) throughout. The product should feel like a tool the user built for himself: every element earns its pixels, nothing is there to impress.

## Anti-references

- **Generic SaaS dashboard.** No card-grid + hero-metric + gradient-accent template. No decorative dashboard chrome. Density here is earned by real data, not faked with big-number widgets.
- **Consumer macro apps (MyFitnessPal, Lose It).** No ad-heavy clutter, no busy multi-color feeds, no upsell surfaces, no streak-badge gamification, no patronizing empty states.
- Also avoid: smartwatch/ring gamification (rings, trophies), and any "wellness app" softness that trades precision for friendliness.

## Design Principles

1. **The number is the interface.** Macros, kcal, load, HRV — the data is the primary UI element. Type, color, and layout exist to make numbers instantly readable and comparable, not to decorate them.
2. **One accent, with meaning.** Green (`--accent`) means on-target and primary action. Macro hues (blue/yellow/orange) are a fixed semantic vocabulary (protein/carbs/fat). Color is information; never decoration.
3. **Fast in, fast out.** Logging is the hot path. Minimize taps, keep the meal context sticky, never make the user wait for choreography.
4. **Glanceable hierarchy.** At arm's length, one-handed, the user should find "how am I doing today" in under a second. Scale and weight carry hierarchy; mono labels stay quiet.
5. **A tool he built for himself.** Consistency and honesty over surprise. No feature exists to look impressive; degrade gracefully when data (ICU, targets, Garmin) is missing.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**, mobile-first. Body text ≥4.5:1, large/bold text ≥3:1 against its actual background (dark theme, so verify the muted grays `--text2 #bbb` / `--text3 #888` on `--bg`/`--surface`). Interactive touch targets ≥44×44px since the app is used one-handed on a phone. Respect `prefers-reduced-motion` for transitions and Chart.js animations. Color is never the sole carrier of meaning (macro hues are paired with mono labels P/C/F and numeric values). Maintain a visible focus state for any keyboard/assistive use even though primary input is touch.
