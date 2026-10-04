# Process Scheduler

A browser-based CPU scheduling simulator built for an Operating Systems course project. Enter a workload, compare nine scheduling algorithms, and explore how each algorithm affects process execution and waiting time.

[Open the website](https://stackvarun.github.io/process-scheduler/)

## Features

- Simulate nine CPU scheduling algorithms using the same process inputs.
- View a Gantt chart with process execution intervals and CPU idle periods.
- Calculate completion, turnaround, waiting, and response times, with totals and averages.
- Compare average waiting, turnaround, and response times across algorithms.
- Explore execution with play/pause, playback speeds, a clock slider, and step controls.
- Inspect each process's status, executed time, remaining burst time, and waiting time during playback.
- Export results to CSV or use the browser's print dialog to save a PDF.
- Use a responsive interface with input validation and an algorithm FAQ.

## Supported algorithms

| Algorithm | Scheduling policy |
| --- | --- |
| First Come, First Served (FCFS) | Non-preemptive; runs processes in arrival order. |
| Shortest Job First (SJF) | Non-preemptive; selects the shortest available burst. |
| Shortest Remaining Time First (SRTF) | Preemptive; selects the shortest remaining burst. |
| Priority — Non-Preemptive | Runs the highest-priority available process to completion. |
| Priority — Preemptive | A newly available process with a higher priority can interrupt execution. |
| Round Robin (RR) | Uses a FIFO ready queue and a configurable time quantum. |
| Highest Response Ratio Next (HRRN) | Non-preemptive; selects the highest ratio of (waiting time + burst time) / burst time. |
| Multilevel Queue (MLQ) | Two fixed queues: Q0 uses Round Robin; Q1 uses FCFS. Q0 has strict priority. |
| Multilevel Feedback Queue (MLFQ) | Three queues: Q0 uses RR with quantum q, Q1 uses RR with quantum 2q, and Q2 uses FCFS. Processes move down after using their allowance. |

A smaller priority number means a higher priority. In MLQ and MLFQ, a ready process in a higher queue can interrupt a process in a lower queue. MLFQ starts every process in Q0 and does not implement aging or periodic priority boosts.

## Technology stack

| Component | Technology |
| --- | --- |
| Page structure | HTML5 |
| Layout and responsive styling | CSS3, Flexbox, Grid, and media queries |
| Scheduling logic and interface | Vanilla JavaScript |
| Gantt chart | HTML elements styled with CSS |
| Hosting | GitHub Pages |
| Algorithm tests | JavaScript, run with Node.js |

The application runs entirely in the browser. It requires no backend, database, external JavaScript libraries, or build step.

## Run locally

Clone the repository:

```bash
git clone https://github.com/StackVarun/process-scheduler.git
cd process-scheduler
```

Start a local server with Python 3:

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in a browser. Press Ctrl+C in the terminal to stop the server.

Python is only needed for this local server; it is not part of the application's scheduling logic.

## How to use

1. Set the number of processes and fill in their arrival and burst times.
2. Set priorities for priority scheduling and queue assignments for MLQ.
3. Choose a time quantum for Round Robin and the multilevel algorithms.
4. Run the simulation and inspect the process results and execution timeline.
5. Click another algorithm in the comparison section to view its results using the same workload.
6. Use playback controls to explore execution, or export the selected results.

The simulator accepts up to 30 processes. Arrival times must be integers from 0 to 10,000; burst times, priorities, and the time quantum must be integers from 1 to 10,000. Process IDs must be unique.

## Scheduling metrics

| Metric | Meaning / calculation |
| --- | --- |
| Completion Time (CT) | Clock time when a process finishes. |
| Turnaround Time (TAT) | Completion time − arrival time. |
| Waiting Time (WT) | Turnaround time − burst time. |
| Response Time (RT) | First execution time − arrival time. |
| Average time | Sum of the corresponding process values ÷ number of processes. |
| CPU utilization | Total burst time ÷ simulation duration × 100. |
| Throughput | Number of completed processes ÷ simulation duration. |

The interface also reports CPU idle time and context switches. Context switches count direct transitions between different running processes; initial dispatch and transitions through idle time are excluded.

## Project files

| File | Purpose |
| --- | --- |
| [index.html](index.html) | Page structure, input controls, results sections, and FAQ. |
| [styles.css](styles.css) | Interface styling, responsive layouts, and print formatting. |
| [app.js](app.js) | Input handling, result rendering, algorithm selection, playback, and exports. |
| [scheduler.js](scheduler.js) | Scheduling algorithms, validation, metric calculations, and playback state. |
| [scheduler.test.js](scheduler.test.js) | Automated checks for scheduling behavior and calculated results. |
| [DEMO_GUIDE.md](DEMO_GUIDE.md) | Reference material for understanding and demonstrating the project. |

## Run the algorithm tests

With Node.js installed, run:

```bash
node scheduler.test.js
```

Node.js is needed for this test command, not for using the website.

## Simulation assumptions and display limits

- One CPU and one CPU burst per process; no I/O blocking is simulated.
- Time values use abstract integer units.
- Context switches have zero time overhead.
- Ties generally use arrival order, then input order. Equal-priority arrivals do not interrupt the currently running process in preemptive priority scheduling.
- Round Robin admits processes arriving at a time-slice boundary before requeueing the current process.
- Consecutive execution intervals for the same process are merged in the displayed timeline.
- The on-screen timeline displays up to 400 segments at once; its window follows playback.
- Printed reports include up to 100 timeline segments. CSV exports include the complete execution timeline.
- Gantt bars have a minimum display width for readability; use their time labels for exact durations.

