# Understand and explain the scheduler

## Files

- `index.html`: the visible page, input controls, and result table containers.
- `styles.css`: colors, spacing, responsive layout, and chart appearance.
- `scheduler.js`: the scheduling calculations. Study this first.
- `app.js`: reads inputs, calls all nine simulations, and displays the chosen result.
- `scheduler.test.js`: correctness checks; not needed to run the website.

## What happens when Run simulation is clicked?

1. `inputs()` reads every process row into objects with id, arrival, burst, priority, and queue.
2. `validate()` rejects invalid integers, duplicate IDs, and invalid quantum/queue values.
3. `simulate()` makes a fresh copy of the processes for each algorithm. Running one algorithm cannot change another algorithm's input.
4. `createState()` holds the clock, arrived jobs, remaining burst times, first start times, completion times, and timeline.
5. The chosen algorithm repeatedly selects a job and calls `execute()`.
6. `execute()` records the first start, advances the clock, reduces remaining time, and records completion when remaining reaches zero.
7. `simulate()` calculates the metrics; `render()` displays the chart, rows, totals, averages, and comparisons.

## Shared variables

| Variable | Meaning |
| --- | --- |
| `time` | Simulated CPU clock, starting at zero |
| `remaining` | CPU time still needed by a job |
| `first` | Timestamp of its first CPU execution |
| `completion` | Timestamp when it finishes |
| `ready` | Jobs that have arrived and can run |
| `cursor` | Next job in the sorted arrival list |
| `completed` | Number of finished jobs |
| `index` | Original input position, used for stable tie-breaking |

`admit()` adds jobs with arrival <= clock. If no job is ready, `idle()` advances directly to the next arrival and records an Idle segment. `segment()` merges adjacent execution intervals belonging to the same job for chart readability.

## Nine algorithms

| Algorithm / code function | Selection and execution |
| --- | --- |
| FCFS / `fcfs()` | Sort ready jobs by arrival, then input position. Run to completion. |
| SJF non-preemptive / `sjf()` | Choose the shortest original burst among ready jobs. Run to completion. |
| SRTF / `srtf()` | Choose the smallest remaining burst at each time unit. New shorter jobs can interrupt. Equal remaining times use arrival, then input position. |
| Priority non-preemptive / `priority()` | Choose the smallest priority number. Run to completion. |
| Priority preemptive / `preemptivePriority()` | Reconsider every unit; interrupt only for a strictly smaller priority number. Equal priority does not interrupt the current job. |
| Round Robin / `roundRobin()` | FIFO queue. Run min(quantum, remaining); admit new arrivals, then requeue the unfinished job. |
| HRRN / `hrrn()` | Recalculate (current wait + burst) / burst; highest ratio runs to completion. |
| MLQ / `multilevel(..., false)` | Fixed Q0 RR(q), Q1 FCFS. Always choose Q0 when nonempty. Q0 interrupts Q1. Jobs never migrate. |
| MLFQ / `multilevel(..., true)` | New jobs enter Q0 RR(q), then Q1 RR(2q), then Q2 FCFS if unfinished. Higher queues interrupt lower queues. No aging/periodic boost. |

FCFS, SJF, non-preemptive Priority, and HRRN share `nonPreemptive()` because the clock/execution steps are identical; only the selection comparison differs. This avoids repeating the same execution code.

For MLQ/MLFQ, an interrupted lower-level job keeps its queue position and consumed time allowance. `used` counts the job's CPU time at its current level, not elapsed wall-clock time. Completing at the exact quantum boundary removes the job rather than demoting/requeueing it.

## Formulas

- CT = finish timestamp.
- TAT = CT - arrival.
- WT = TAT - burst.
- RT = first execution - arrival.
- Total = sum of a column across processes.
- Average = total / process count.
- CPU utilization = total burst / final completion timestamp * 100.
- Throughput = process count / final completion timestamp.

Elapsed time starts at 0 and includes idle intervals. Sum of CT is the sum of finish timestamps, not elapsed CPU time. Context switches count direct changes between distinct jobs; initial dispatch and transitions through Idle are excluded. Switch overhead is zero.

## Trace an example

Load the sample (quantum 2):

| Process | Arrival | Burst | Priority | MLQ queue |
| --- | ---: | ---: | ---: | ---: |
| P1 | 0 | 8 | 3 | 0 |
| P2 | 1 | 4 | 1 | 1 |
| P3 | 2 | 2 | 2 | 0 |
| P4 | 3 | 1 | 1 | 1 |

For SRTF: P1 0–1, P2 1–2, P3 2–4, P4 4–5, P2 5–8, P1 8–15. At t=3, P3 and P4 both have one remaining unit; P3 wins the earlier-arrival tie. P2 finishes at 8: TAT=8−1=7 and WT=7−4=3.

For preemptive Priority: P1 0–1, P2 1–5, P4 5–6, P3 6–8, P1 8–15. P4 arriving with equal priority does not interrupt P2.

For HRRN at t=8: P2 ratio=(7+4)/4=2.75, P3=(6+2)/2=4, P4=(5+1)/1=6. P4 runs first. Recalculate after it finishes; do not reuse the previous ratios.

## Demo practice

Explain a small input aloud: which jobs are ready, which rule selects the next job, how long it runs, whether a new arrival interrupts, and how CT/TAT/WT are computed. Then demonstrate an idle period, an equal-priority arrival, and Round Robin quantum changes.

Model: one CPU, one burst per job, no I/O blocking, integer time units. MLQ and MLFQ have configurable-policy alternatives in textbooks; these are the exact policies implemented here.
