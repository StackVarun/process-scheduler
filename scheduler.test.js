const assert = require('node:assert/strict');
const { simulate, ALGORITHMS } = require('./scheduler.js');
const sample = [{ id: 'P1', arrival: 0, burst: 8 }, { id: 'P2', arrival: 1, burst: 4 }, { id: 'P3', arrival: 2, burst: 2 }, { id: 'P4', arrival: 3, burst: 1 }];
const completion = (r) => r.rows.map(p => p.completion);
assert.deepEqual(completion(simulate(sample, 'fcfs')), [8, 12, 14, 15]);
assert.deepEqual(completion(simulate(sample, 'sjn')), [8, 15, 11, 9]);
assert.deepEqual(completion(simulate(sample, 'rr', 2)), [15, 11, 6, 9]);
assert.equal(simulate(sample, 'rr', 2).contextSwitches, 6);
assert.deepEqual(['waiting', 'turnaround', 'response'].map(k => simulate(sample, 'fcfs', 2).averages[k]), [7, 10.75, 7]);
assert.deepEqual(['waiting', 'turnaround', 'response'].map(k => simulate(sample, 'sjn', 2).averages[k]), [5.5, 9.25, 5.5]);
assert.deepEqual(['waiting', 'turnaround', 'response'].map(k => simulate(sample, 'rr', 2).averages[k]), [5, 8.75, 2]);
const idle = [{ id: 'A', arrival: 3, burst: 2 }, { id: 'B', arrival: 9, burst: 1 }];
for (const algorithm of ALGORITHMS) {
    const r = simulate(idle, algorithm, 1); assert.equal(r.idle, 7); assert.equal(r.contextSwitches, 0); assert.equal(r.utilization, 30); assert.deepEqual(completion(r), [5, 10]);
    const one = simulate([{ id: 'A', arrival: 0, burst: 7 }], algorithm, 2); assert.equal(one.contextSwitches, 0); assert.equal(one.timeline.length, 1); assert.equal(one.rows[0].waiting, 0);
}
const boundary = [{ id: 'A', arrival: 0, burst: 4 }, { id: 'B', arrival: 2, burst: 1 }];
assert.deepEqual(simulate(boundary, 'rr', 2).timeline.map(s => s.id), ['A', 'B', 'A']);
const tied = [{ id: 'Z', arrival: 0, burst: 2 }, { id: 'A', arrival: 0, burst: 2 }];
assert.deepEqual(completion(simulate(tied, 'sjn')), [2, 4]);
assert.deepEqual(completion(simulate([...sample].reverse(), 'fcfs')), [15, 14, 12, 8]);
for (const invalid of [[], [{ id: 'A', arrival: -1, burst: 2 }], [{ id: 'A', arrival: 0, burst: 0 }], [{ id: 'A', arrival: 0.5, burst: 1 }], [{ id: 'A', arrival: 0, burst: 1 }, { id: 'A', arrival: 1, burst: 2 }]]) assert.throws(() => simulate(invalid));
assert.throws(() => simulate(sample, 'rr', 0));
assert.throws(() => simulate(sample, 'rr', NaN));
// Deterministic workloads: verify conservation of CPU work and time identities.
let seed = 41; const random = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
for (let i = 0; i < 100; i++) {
    const input = Array.from({ length: 1 + random(8) }, (_, j) => ({ id: 'P' + j, arrival: random(15), burst: 1 + random(12) }));
    for (const algorithm of ALGORITHMS) {
        const r = simulate(input, algorithm, 1 + random(5)); let end = 0;
        for (const s of r.timeline) { assert.equal(s.start, end); assert.ok(s.end > s.start); end = s.end; }
        assert.equal(end, r.makespan);
        for (const p of r.rows) { assert.equal(r.timeline.filter(s => s.id === p.id).reduce((n, s) => n + s.end - s.start, 0), p.burst); assert.ok(p.waiting >= 0); assert.ok(p.response >= 0); assert.ok(p.response <= p.waiting); assert.equal(p.turnaround, p.waiting + p.burst); }
        assert.equal(r.busy + r.idle, r.makespan);
    }
}


// Independently hand-calculated expected completion times.
assert.deepEqual(completion(simulate(sample, 'srtf')), [15, 8, 4, 5]);
const ranked = sample.map((p, i) => ({ ...p, priority: [3, 1, 2, 1][i], queue: i % 2 }));
assert.deepEqual(completion(simulate(ranked, 'priority')), [8, 12, 15, 13]);
assert.deepEqual(completion(simulate(ranked, 'priority_p')), [15, 5, 8, 6]);
assert.deepEqual(completion(simulate(sample, 'hrrn')), [8, 15, 11, 9]);
assert.deepEqual(completion(simulate(ranked, 'mlq', 2)), [10, 14, 4, 15]);
assert.deepEqual(completion(simulate(sample, 'mlfq', 2)), [15, 13, 6, 7]);
// Preemptive priority keeps equal-priority current jobs running.
const equal = [{ id: 'A', arrival: 2, burst: 4, priority: 1 }, { id: 'B', arrival: 0, burst: 8, priority: 2 }, { id: 'C', arrival: 3, burst: 1, priority: 2 }];
assert.deepEqual(completion(simulate(equal, 'priority_p')), [6, 12, 13]);
// Strict high-queue priority interrupts a low job immediately.
const interrupt = [{ id: 'L', arrival: 0, burst: 5, queue: 1 }, { id: 'H', arrival: 2, burst: 1, queue: 0 }];
assert.deepEqual(simulate(interrupt, 'mlq').timeline.map(s => [s.id, s.start, s.end]), [['L', 0, 2], ['H', 2, 3], ['L', 3, 6]]);
// MLFQ retains partially consumed lower-level budgets across interruption.
const feedback = [{ id: 'A', arrival: 0, burst: 10 }, { id: 'B', arrival: 3, burst: 1 }, { id: 'C', arrival: 7, burst: 1 }];
assert.deepEqual(simulate(feedback, 'mlfq', 2).timeline.map(s => [s.id, s.start, s.end]), [['A', 0, 3], ['B', 3, 4], ['A', 4, 7], ['C', 7, 8], ['A', 8, 12]]);
for (const algorithm of ALGORITHMS) {
    const r = simulate(ranked, algorithm, 2);
    for (const key of ['arrival', 'burst', 'completion', 'turnaround', 'waiting', 'response']) {
        assert.equal(r.totals[key], r.rows.reduce((sum, p) => sum + p[key], 0));
        assert.equal(r.averages[key], r.totals[key] / r.rows.length);
    }
}
console.log('Passed: all nine algorithms, hand-calculated schedules, preemption, RR boundaries, queue rules, totals/averages, invalid inputs, and 900 generated schedule invariant checks.');
