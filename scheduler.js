/* Scheduling logic only: usable in both the browser and Node.js. */
(function (root) {
  'use strict';
  const LIMITS = { processes: 30, time: 10000 };
  const ALGORITHMS = ['fcfs', 'sjf', 'srtf', 'priority', 'priority_p', 'rr', 'hrrn', 'mlq', 'mlfq'];

  function validate(input, quantum) {
    if (!Array.isArray(input) || !input.length || input.length > LIMITS.processes)
      throw new Error('Enter between 1 and 30 processes.');
    const seen = new Set();
    input.forEach(p => {
      if (typeof p.id !== 'string' || !p.id.trim() || p.id.length > 16 || seen.has(p.id.trim()))
        throw new Error('Process IDs must be unique, non-empty, and at most 16 characters.');
      seen.add(p.id.trim());
      if (!Number.isInteger(p.arrival) || p.arrival < 0 || p.arrival > LIMITS.time)
        throw new Error('Arrival times must be whole numbers from 0 to 10000.');
      if (!Number.isInteger(p.burst) || p.burst < 1 || p.burst > LIMITS.time)
        throw new Error('Burst times must be whole numbers from 1 to 10000.');
      if (p.priority !== undefined && (!Number.isInteger(p.priority) || p.priority < 1 || p.priority > 10000))
        throw new Error('Priorities must be whole numbers from 1 to 10000. Smaller numbers have higher priority.');
      if (p.queue !== undefined && ![0, 1].includes(p.queue))
        throw new Error('MLQ queue must be 0 (high) or 1 (low).');
    });
    if (!Number.isInteger(quantum) || quantum < 1 || quantum > LIMITS.time)
      throw new Error('Time quantum must be a whole number from 1 to 10000.');
  }
  const arrivalOrder = (a, b) => a.arrival - b.arrival || a.index - b.index;

  // Shared clock, ready queue and Gantt chart operations.
  function createState(input) {
    const processes = input.map((p, index) => ({ ...p, id: p.id.trim(), index,
      priority: p.priority ?? 1, queue: p.queue ?? 0,
      remaining: p.burst, first: null, completion: 0 }));
    const arrivals = [...processes].sort(arrivalOrder);
    const state = { processes, ready: [], timeline: [], time: 0, cursor: 0, completed: 0 };
    state.admit = (enqueue = p => state.ready.push(p)) => {
      while (state.cursor < arrivals.length && arrivals[state.cursor].arrival <= state.time)
        enqueue(arrivals[state.cursor++]);
    };
    state.segment = (p, duration) => {
      const id = p ? p.id : null, last = state.timeline.at(-1);
      if (last && last.id === id) last.end += duration;
      else state.timeline.push({ id, index: p ? p.index : -1, start: state.time, end: state.time + duration });
      state.time += duration;
    };
    state.idle = () => state.segment(null, arrivals[state.cursor].arrival - state.time);
    state.execute = (p, duration) => {
      if (p.first === null) p.first = state.time;
      state.segment(p, duration);
      p.remaining -= duration;
      if (p.remaining === 0) { p.completion = state.time; state.completed++; }
    };
    return state;
  }

  // FCFS, SJF and non-preemptive priority differ only in selection order.
  function nonPreemptive(state, compare) {
    while (state.completed < state.processes.length) {
      state.admit();
      if (!state.ready.length) { state.idle(); state.admit(); }
      state.ready.sort(compare);
      const process = state.ready.shift();
      state.execute(process, process.remaining);
    }
  }
  function fcfs(state) { nonPreemptive(state, arrivalOrder); }
  function sjf(state) {
    nonPreemptive(state, (a, b) => a.burst - b.burst || arrivalOrder(a, b));
  }
  function priority(state) {
    nonPreemptive(state, (a, b) => a.priority - b.priority || arrivalOrder(a, b));
  }

  function hrrn(state) {
    // Recompute response ratios at every dispatch. HRRN is non-preemptive.
    nonPreemptive(state, (a, b) => {
      const ratioA = (state.time - a.arrival + a.burst) / a.burst;
      const ratioB = (state.time - b.arrival + b.burst) / b.burst;
      return ratioB - ratioA || arrivalOrder(a, b);
    });
  }
  function preemptivePriority(state) {
    let current = null;
    while (state.completed < state.processes.length) {
      state.admit();
      if (!state.ready.length) { state.idle(); state.admit(); }
      state.ready.sort((a, b) => a.priority - b.priority || arrivalOrder(a, b));
      const best = state.ready[0];
      // Equal priority does not interrupt the current job.
      if (!current || current.remaining === 0 || best.priority < current.priority) current = best;
      state.execute(current, 1);
      if (current.remaining === 0) state.ready.splice(state.ready.indexOf(current), 1);
    }
  }

  function srtf(state) {
    while (state.completed < state.processes.length) {
      state.admit();
      if (!state.ready.length) { state.idle(); state.admit(); }
      state.ready.sort((a, b) => a.remaining - b.remaining || arrivalOrder(a, b));
      const process = state.ready[0];
      // Reconsider the choice every time unit so arrivals can preempt.
      state.execute(process, 1);
      if (process.remaining === 0) state.ready.shift();
    }
  }

  function roundRobin(state, quantum) {
    while (state.completed < state.processes.length) {
      state.admit();
      if (!state.ready.length) { state.idle(); state.admit(); }
      const process = state.ready.shift();
      state.execute(process, Math.min(quantum, process.remaining));
      // Admit boundary arrivals before requeueing the current process.
      state.admit();
      if (process.remaining > 0) state.ready.push(process);
    }
  }

  function multilevel(state, quantum, feedback) {
    const queues = feedback ? [[], [], []] : [[], []];
    const budgets = feedback ? [quantum, 2 * quantum, Infinity] : [quantum, Infinity];
    const enqueue = p => {
      p.level = feedback ? 0 : p.queue;
      p.used = 0;
      queues[p.level].push(p);
    };
    while (state.completed < state.processes.length) {
      state.admit(enqueue);
      let level = queues.findIndex(queue => queue.length > 0);
      if (level === -1) {
        state.idle(); state.admit(enqueue);
        level = queues.findIndex(queue => queue.length > 0);
      }
      const process = queues[level][0];
      state.execute(process, 1);
      process.used++;
      // Higher queues preempt lower queues at the next time unit.
      // An interrupted process stays at its queue's front and keeps its budget.
      state.admit(enqueue);
      if (process.remaining === 0) queues[level].shift();
      else if (process.used >= budgets[level]) {
        queues[level].shift();
        if (feedback) process.level = Math.min(level + 1, queues.length - 1);
        process.used = 0;
        queues[process.level].push(process);
      }
    }
  }

  function simulate(input, algorithm = 'fcfs', quantum = 2) {
    validate(input, quantum);
    if (algorithm === 'sjn') algorithm = 'sjf'; // Old-version compatibility.
    if (!ALGORITHMS.includes(algorithm)) throw new Error('Unknown scheduling algorithm.');
    const state = createState(input);
    const runners = { fcfs, sjf, srtf, priority, priority_p: preemptivePriority, hrrn,
      rr: s => roundRobin(s, quantum), mlq: s => multilevel(s, quantum, false),
      mlfq: s => multilevel(s, quantum, true) };
    runners[algorithm](state);
    const rows = state.processes.map(p => ({ id: p.id, index: p.index,
      arrival: p.arrival, burst: p.burst, priority: p.priority, queue: p.queue,
      completion: p.completion, turnaround: p.completion - p.arrival,
      waiting: p.completion - p.arrival - p.burst, response: p.first - p.arrival }));
    const totals = {}, averages = {};
    for (const key of ['arrival', 'burst', 'completion', 'turnaround', 'waiting', 'response']) {
      totals[key] = rows.reduce((sum, p) => sum + p[key], 0);
      averages[key] = totals[key] / rows.length;
    }
    let contextSwitches = 0;
    state.timeline.forEach((segment, i) => {
      if (i && segment.id !== null && state.timeline[i - 1].id !== null) contextSwitches++;
    });
    const time = state.time, busy = totals.burst;
    return { algorithm, quantum, rows, timeline: state.timeline, contextSwitches,
      makespan: time, busy, idle: time - busy, utilization: 100 * busy / time,
      throughput: rows.length / time, totals, averages };
  }
  // Read a finished schedule at any clock time without changing its results.
  // Per-process intervals keep playback fast even when Round Robin has many slices.
  function createPlayback(result) {
    const intervals = result.rows.map(() => []);
    const consumed = result.rows.map(() => 0);
    const eventTimes = new Set([0, result.makespan]);
    result.rows.forEach(p => eventTimes.add(p.arrival));
    result.timeline.forEach(segment => {
      eventTimes.add(segment.start); eventTimes.add(segment.end);
      if (segment.index < 0) return;
      const i = segment.index, before = consumed[i], duration = segment.end - segment.start;
      intervals[i].push({ start: segment.start, end: segment.end, before });
      // The chart merges consecutive slices of one process. Restore quantum
      // boundaries for playback, including a lone process using several quanta.
      if (result.algorithm === 'rr' || (result.algorithm === 'mlq' && result.rows[i].queue === 0)) {
        for (let amount = (Math.floor(before / result.quantum) + 1) * result.quantum;
          amount < before + duration; amount += result.quantum)
          eventTimes.add(segment.start + amount - before);
      }
      if (result.algorithm === 'mlfq') {
        for (const amount of [result.quantum, 3 * result.quantum])
          if (amount > before && amount < before + duration)
            eventTimes.add(segment.start + amount - before);
      }
      consumed[i] += duration;
    });
    const events = [...eventTimes].sort((a, b) => a - b);
    // Find the final item whose clock field is at or before the requested time.
    function lastAt(items, time, clock) {
      let low = 0, high = items.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (clock(items[middle]) <= time) low = middle + 1;
        else high = middle;
      }
      return low - 1;
    }
    function at(time) {
      const t = Math.max(0, Math.min(result.makespan, Math.trunc(time)));
      const segmentIndex = lastAt(result.timeline, t, s => s.start);
      const segment = t < result.makespan ? result.timeline[segmentIndex] : null;
      const running = segment && segment.index >= 0 ? segment.index : -1;
      const rows = result.rows.map(p => {
        const runs = intervals[p.index], runIndex = lastAt(runs, t, s => s.start);
        const run = runs[runIndex];
        const executed = run ? run.before + Math.min(t, run.end) - run.start : 0;
        const remaining = p.burst - executed;
        const status = p.arrival > t ? 'Not arrived' : remaining === 0 ? 'Completed' : p.index === running ? 'Running' : 'Ready';
        const level = result.algorithm === 'mlfq' ? (executed < result.quantum ? 0 : executed < 3 * result.quantum ? 1 : 2) : p.queue;
        return { ...p, executed, remaining, status, level,
          waitingSoFar: Math.max(0, Math.min(t, p.completion) - p.arrival - executed) };
      });
      const eventIndex = lastAt(events, t, value => value);
      return { time: t, running, segmentIndex, rows,
        previousEvent: events[Math.max(0, events[eventIndex] === t ? eventIndex - 1 : eventIndex)],
        nextEvent: events[Math.min(events.length - 1, eventIndex + 1)] };
    }
    return { at, events };
  }
  const api = { simulate, validate, createPlayback, LIMITS, ALGORITHMS, VERSION: '20261003.8' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scheduler = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
