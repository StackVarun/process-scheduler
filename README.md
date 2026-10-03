# Process Scheduler — Nine Algorithms

Plain HTML, CSS, and JavaScript. No build step, framework, database, or backend required. Compatible with GitHub Pages.

## Update from the previous version

Keep the old folder as a backup. Extract the entire ZIP into its new `process-scheduler-fixed` folder. Stop any old server with Control+C. Open the new folder in VS Code and start its server. Avoid combining individual files from different downloads. Refresh with Cmd+Shift+R. Assets have a shared version identifier to avoid loading stale CSS/JavaScript.

## Run on your Mac

Open this folder in VS Code. In its terminal run:

```bash
python3 -m http.server 8000
```

Visit http://localhost:8000. Stop with Control+C. You can also open index.html directly.

## Features

- FCFS, non-preemptive SJF, SRTF (preemptive SJF), non-preemptive Priority, preemptive Priority, Round Robin, HRRN, MLQ, and MLFQ.
- Choose 1–30 process rows by typing the count and pressing Enter (or clicking outside), or use + / −. Add/remove individual rows.
- Input arrival, burst, priority, MLQ queue, and base time quantum.
- Gantt chart with idle periods; per-process CT, TAT, WT, and response time.
- Total and Average rows for arrival, burst, CT, TAT, WT, and response.
- Click any algorithm name in the comparison table to display its results and timeline, retaining your inputs. The algorithm dropdown stays synchronized. Changed inputs are recalculated automatically when switching.
- Compare all nine algorithms using the same input; CPU utilization, throughput, and context-switch count.
- Sample data, reset, input validation, and explicit scheduling rules.

## Scheduling policies

Smaller priority numbers mean higher priority. Priority NP runs to completion. Priority P interrupts only for a strictly higher priority; equal priority does not preempt. HRRN chooses the highest (waiting + burst) / burst at every dispatch and is non-preemptive.

MLQ: fixed Q0 with RR(q) and Q1 with FCFS. Q0 has strict priority and interrupts Q1. Jobs never change queues.

MLFQ: all jobs start at Q0 RR(q); exhausting its allowance demotes to Q1 RR(2q), then Q2 FCFS. Higher queues interrupt lower queues. Interrupted jobs retain their queue position and consumed allowance. No periodic priority boost or aging.

FCFS/SJF/SRTF/HRRN and dispatch ties use arrival time, then input position. RR admits arrivals at slice boundaries before requeueing the unfinished job. Adjacent same-job segments merge visually. Charts show at most the first 400 segments with a notice, while results use the full schedule.

One CPU, one burst per job, no I/O blocking, zero switching overhead. Context switches count only direct changes between different jobs. Time is in abstract integer units. Arrival 0–10,000; burst, quantum, and priority 1–10,000. MLQ queue is High (0) or Low (1). Numeric fields use plain typing; no spinner or mouse-wheel changes.

## Files and learning

See DEMO_GUIDE.md for function-by-function explanations, variables, formulas, queue policies, and traces. scheduler.js contains the algorithm code; app.js reads inputs and renders results. index.html and styles.css define the interface.

## Checks

```bash
node scheduler.test.js
```

Checks cover all nine algorithms, expected schedules, RR boundaries, priority preemption, MLQ interruptions, MLFQ budgets, idle periods, totals/averages, validation, and 900 generated timing/work-conservation checks. Node is needed only for these tests.

## Publish on GitHub Pages

1. Create an empty GitHub repository named `process-scheduler`. A public repository is the simplest option.
2. In VS Code's terminal, from this folder, run:

```bash
git init
git add .
git commit -m "Build CPU scheduling simulator"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/process-scheduler.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. Authenticate to GitHub if prompted; do not use your account password as a Git password.

3. In the GitHub repository: **Settings → Pages → Build and deployment**.
4. Choose **Deploy from a branch**, select **main** and **/(root)**, and save.
5. Wait for deployment to finish. The URL will be `https://YOUR_USERNAME.github.io/process-scheduler/`.

Keep `index.html` at the repository root, not inside another nested folder. All asset links are relative so repository-based Pages URLs work.

For subsequent changes:

```bash
git add .
git commit -m "Update scheduler"
git push
```

## Report handoff

Capture each algorithm's chart and result table using the same input. Include quantum, priority convention, queue assignments and policies with screenshots. The Total CT column is a sum of timestamps, not CPU elapsed time. This is a scheduling simulation, not control of your Mac's operating system.
