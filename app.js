'use strict';
const $=id=>document.getElementById(id);
// Change to true when you want HRRN, MLQ and MLFQ back in the website.
const SHOW_EXTRA_ALGORITHMS=false;
const visibleAlgorithms=['fcfs','sjf','srtf','priority','priority_p','rr',...(SHOW_EXTRA_ALGORITHMS?['hrrn','mlq','mlfq']:[])];
function configureAlgorithms(){
  $('algorithm').replaceChildren(...visibleAlgorithms.map(key=>{const option=el('option',({fcfs:'FCFS',sjf:'SJF — Non-Preemptive',srtf:'SRTF — Preemptive SJF',priority:'Priority — Non-Preemptive',priority_p:'Priority — Preemptive',rr:'Round Robin',hrrn:'HRRN',mlq:'Multilevel Queue (MLQ)',mlfq:'Multilevel Feedback Queue (MLFQ)'})[key]);option.value=key;return option;}));
  $('algorithm').value='fcfs';
  for(const id of ['mlq-column','faq-hrrn','faq-mlq','faq-mlfq'])$(id).hidden=!SHOW_EXTRA_ALGORITHMS;
  $('compare-title').textContent='Same workload. '+(SHOW_EXTRA_ALGORITHMS?'Nine':'Six')+' approaches.';
  $('quantum-help').textContent=SHOW_EXTRA_ALGORITHMS?'RR and MLQ use q. MLFQ uses q, then 2q.':'Round Robin uses q as its time slice.';
  $('editor-help').textContent='Smaller priority number = higher priority. '+(SHOW_EXTRA_ALGORITHMS?'MLQ: High uses RR; Low uses FCFS. ':'')+'These inputs also feed the comparison.';
  $('input-algorithms-help').textContent='Arrival and burst affect all available algorithms. Priority numbers affect the two Priority variants. '+(SHOW_EXTRA_ALGORITHMS?'The MLQ queue assignment affects only MLQ. Quantum affects Round Robin, MLQ and MLFQ. ':'Quantum affects Round Robin. ')+'The comparison uses the same input rows for every algorithm.';
  $('algorithm-footer').textContent='FCFS / SJF / SRTF / PRIORITY NP & P / RR'+(SHOW_EXTRA_ALGORITHMS?' / HRRN / MLQ / MLFQ':'');
  $('playback-detail-heading').textContent=SHOW_EXTRA_ALGORITHMS?'Priority / queue':'Priority';
}

const palette=['#2553df','#078080','#8751cb','#b36016','#bb3e6a','#4e688d','#537a13','#9a482d'];
const names={fcfs:'First-Come-First-Served',sjf:'Shortest Job First',srtf:'Shortest Remaining Time First',priority:'Priority — Non-Preemptive',priority_p:'Priority — Preemptive',hrrn:'Highest Response Ratio Next (HRRN)',mlq:'Multilevel Queue',mlfq:'Multilevel Feedback Queue',rr:'Round Robin'};
const descriptions={fcfs:'Processes run to completion in arrival order. Earlier arrivals are served first.',sjf:'The shortest available job runs to completion. New arrivals do not interrupt the running process.',rr:'Each ready process gets up to one time quantum, then returns to the back of the queue if unfinished.'};
Object.assign(descriptions,{priority_p:'The smallest priority number runs. A higher-priority arrival interrupts the running job; equal priority does not preempt.',hrrn:'Highest (waiting + burst) / burst runs next, to completion. Ratios are recalculated at each dispatch.',srtf:'The process with the shortest remaining time runs. A shorter arriving job can interrupt it.',priority:'The ready process with the smallest priority number runs to completion. Ties use arrival, then input order.',mlq:'Fixed queues: Q0 uses Round Robin (q); Q1 uses FCFS. Q0 always preempts Q1. Processes never change queues.',mlfq:'All jobs start in Q0 (q). Unfinished jobs move to Q1 (2q), then Q2 (FCFS). Higher queues preempt lower queues; interrupted budgets are preserved. No periodic boost.'});
const sample=[{id:'P1',arrival:0,burst:8},{id:'P2',arrival:1,burst:4},{id:'P3',arrival:2,burst:2},{id:'P4',arrival:3,burst:1}];
sample.forEach((p,i)=>{p.priority=[3,1,2,1][i];p.queue=i%2;});
let lastResults=null;
let inputsChanged=false;
let displayedResult=null;
let timelineWindowStart=0;
let playbackModel=null;
let playbackTime=0;
let playbackTimer=null;
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function color(index){return index<0?'#778397':palette[index%palette.length];}
function number(value){return value.toFixed(2);}
function markDirty(){inputsChanged=true;pausePlayback();$('playback-controls').disabled=true;$('playback-note').textContent='Inputs changed. Run the simulation to update playback.';if(lastResults)$('run-state').textContent='Inputs changed · run again';$('report-status').textContent='';$('error').hidden=true;}
function updateCount(){const count=$('process-inputs').children.length;$('process-count').textContent=count+' / 30';$('add-process').disabled=count>=30;$('process-number').value=count;$('count-minus').disabled=count<=1;$('count-plus').disabled=count>=30;document.querySelectorAll('.remove').forEach(b=>b.disabled=count===1);}
function numericValue(value){return /^\d+$/.test(String(value).trim())?Number(value):NaN;}
function addRow(p){
  const tr=el('tr');
  const labels={id:'Process',arrival:'Arrival time',burst:'Burst time',priority:'Priority',queue:'MLQ queue'};
  ['id','arrival','burst','priority','queue'].forEach(key=>{
    const td=el('td');td.dataset.label=labels[key];if(key==='queue')td.hidden=!SHOW_EXTRA_ALGORITHMS;
    const input=el(key==='queue'?'select':'input');input.dataset.field=key;
    input.setAttribute('aria-label',labels[key]+' for '+p.id);
    if(key==='queue'){
      for(const [value,label] of [[0,'High (RR)'],[1,'Low (FCFS)']]){const option=el('option',label);option.value=value;input.append(option);}
    }else{
      input.type='text';input.maxLength=key==='id'?16:5;
      if(key!=='id'){input.inputMode='numeric';input.setAttribute('autocomplete','off');}
    }
    input.value=p[key] ?? (key==='queue'?0:1);
    input.addEventListener('input',markDirty);input.addEventListener('change',markDirty);
    td.append(input);tr.append(td);
  });
  const td=el('td');td.className='remove-cell';
  const button=el('button','×','remove');button.type='button';button.setAttribute('aria-label','Remove '+p.id);
  button.addEventListener('click',()=>{tr.remove();updateCount();markDirty();});
  td.append(button);tr.append(td);$('process-inputs').append(tr);updateCount();
}
function setRows(rows){$('process-inputs').replaceChildren();rows.forEach(addRow);}
function inputs(){return [...$('process-inputs').children].map(tr=>{
  const p={};tr.querySelectorAll('[data-field]').forEach(input=>{
    p[input.dataset.field]=input.dataset.field==='id'?input.value.trim():numericValue(input.value);
  });return p;
});}
function renderTimeline(result,start=timelineWindowStart){
  const track=el('div',undefined,'gantt-track');
  // Bound DOM size on very long schedules; full calculations remain intact.
  timelineWindowStart=start;
  const limit=400, shown=result.timeline.slice(start,start+limit), available=Math.max(180,$('gantt').clientWidth-32);
  shown.forEach((s,i)=>{const segment=el('div',s.id===null?'Idle':s.id,'gantt-segment');segment.dataset.segment=start+i;segment.style.background=color(s.index);segment.style.width=Math.max(56,(s.end-s.start)/result.makespan*available)+'px';segment.title=(s.id===null?'Idle':s.id)+': '+s.start+'–'+s.end+' ('+(s.end-s.start)+' time units)';segment.append(el('span',String(s.start),'tick'));if(i===shown.length-1)segment.append(el('span',String(s.end),'tick end'));track.append(segment);});
  $('gantt').replaceChildren(track);$('gantt').scrollLeft=0;
  $('timeline-note').textContent=result.timeline.length>limit?'Showing segments '+(start+1)+'–'+(start+shown.length)+' of '+result.timeline.length+'. Playback moves this window to the current time. All results use the complete schedule.':'Segment widths have a minimum for readability; use the time labels for exact durations.';
  $('legend').replaceChildren();result.rows.forEach(p=>{const label=el('span'),swatch=el('i',undefined,'swatch');swatch.style.background=color(p.index);label.append(swatch,document.createTextNode(p.id));$('legend').append(label);});
}
function render(all,status){
  const key=$('algorithm').value,r=all[key];if(!r)throw new Error('Select a supported algorithm and run again.');lastResults=all;displayedResult=r;inputsChanged=false;
  $('result-title').textContent=names[key];$('algorithm-description').textContent=descriptions[key];$('run-state').textContent=status;
  $('avg-wait').textContent=number(r.averages.waiting);$('avg-turn').textContent=number(r.averages.turnaround);$('avg-response').textContent=number(r.averages.response);
  $('total-time').textContent='0–'+r.makespan+' time units';$('utilization').textContent=number(r.utilization)+'%';$('switches').textContent=r.contextSwitches;$('idle').textContent=r.idle;
  renderTimeline(r,0);$('results-body').replaceChildren();
  r.rows.forEach(p=>{const tr=el('tr');['id','arrival','burst','completion','turnaround','waiting','response'].forEach(field=>{const td=el('td',String(p[field]));td.dataset.label=({arrival:'Arrival time',burst:'Burst time',completion:'Completion (CT)',turnaround:'Turnaround (TAT)',waiting:'Waiting (WT)',response:'Response (RT)'})[field]||'Process';if(field==='id'){const dot=el('i',undefined,'swatch');dot.style.background=color(p.index);td.prepend(dot);}tr.append(td);});$('results-body').append(tr);});
  $('results-summary').replaceChildren();
  for(const kind of ['totals','averages']){
    const tr=el('tr');tr.append(el('th',kind==='totals'?'Total':'Average'));
    ['arrival','burst','completion','turnaround','waiting','response'].forEach(field=>{const td=el('td',number(r[kind][field]));td.dataset.label=({arrival:'Arrival time',burst:'Burst time',completion:'Completion (CT)',turnaround:'Turnaround (TAT)',waiting:'Waiting (WT)',response:'Response (RT)'})[field];tr.append(td);});
    $('results-summary').append(tr);
  }
  $('throughput').textContent=r.throughput.toFixed(4)+' processes/unit';
  const minimum=metric=>Math.min(...Object.values(all).map(x=>x.averages[metric]));$('comparison-body').replaceChildren();
  Object.entries(all).forEach(([algorithm,result])=>{const tr=el('tr',undefined,algorithm===key?'selected':'');const title=el('td');
    const label=({priority:'Priority (NP)',priority_p:'Priority (P)',rr:'Round Robin'})[algorithm] || algorithm.toUpperCase();
    const button=el('button',label,'algorithm-link');button.type='button';button.dataset.algorithm=algorithm;
    button.setAttribute('aria-label','View '+names[algorithm]+' results');button.setAttribute('aria-pressed',String(algorithm===key));
    button.addEventListener('click',()=>selectAlgorithm(algorithm,true));title.append(button);
    if(algorithm==='rr')title.append(el('small',' · q='+result.quantum));tr.append(title);['waiting','turnaround','response'].forEach(metric=>{const best=Math.abs(result.averages[metric]-minimum(metric))<1e-9;const td=el('td',number(result.averages[metric]),best?'best':'');td.dataset.label='Avg. '+metric;if(best)td.setAttribute('aria-label',number(result.averages[metric])+', lowest average '+metric);tr.append(td);});const switches=el('td',String(result.contextSwitches));switches.dataset.label='Context switches';tr.append(switches);$('comparison-body').append(tr);});
  const winners=Object.entries(all).filter(([,r])=>Math.abs(r.averages.waiting-minimum('waiting'))<1e-9).map(([k])=>({priority:'Priority (NP)',priority_p:'Priority (P)'})[k]||k.toUpperCase());$('comparison-note').textContent=winners.join(' and ')+' '+(winners.length===1?'has':'share')+' the lowest average waiting time for this input. Results can change with the workload and time quantum.';
  $('report-status').textContent='';resetPlayback(r);
}
function run(status='Simulation complete'){
  try{if(typeof Scheduler==='undefined'||Scheduler.VERSION!=='20261003.9')throw new Error('The project files are from different versions. Run the latest updater in this folder, then restart the server and refresh the page.');const rows=inputs(),q=numericValue($('quantum').value);if(numericValue($('process-number').value)!==rows.length)throw new Error('Enter a valid process count from 1 to 30 and press Enter.');Scheduler.validate(rows,q);const all={};visibleAlgorithms.forEach(k=>all[k]=Scheduler.simulate(rows,k,q));render(all,status);$('error').hidden=true;return true;}
  catch(e){pausePlayback();$('playback-controls').disabled=true;$('playback-note').textContent='Fix the inputs and run again to update playback.';$('report-status').textContent='Report blocked: fix the input error above.';$('error').textContent=e.message;$('error').hidden=false;$('run-state').textContent='Fix inputs · previous results shown';return false;}
}
// Reuse the same workload when selecting a comparison row or dropdown option.
function selectAlgorithm(algorithm,scrollToResults=false){
  if(!visibleAlgorithms.includes(algorithm))return;
  $('algorithm').value=algorithm;
  if(inputsChanged||!lastResults){if(!run())return;}
  else {render(lastResults,'Showing '+names[algorithm]);$('error').hidden=true;}
  if(scrollToResults){
    const heading=$('result-title');heading.focus({preventScroll:true});
    heading.scrollIntoView({behavior:'auto',block:'start'});
  }
}
$('add-process').addEventListener('click',()=>{const used=new Set(inputs().map(p=>p.id));let i=1;while(used.has('P'+i))i++;addRow({id:'P'+i,arrival:0,burst:1});markDirty();$('process-inputs').lastElementChild.querySelector('input').focus();});
$('run').addEventListener('click',()=>run());$('algorithm').addEventListener('change',()=>selectAlgorithm($('algorithm').value));$('quantum').addEventListener('input',markDirty);
$('sample').addEventListener('click',()=>{setRows(sample);$('quantum').value=2;run('Sample results');});
$('reset').addEventListener('click',()=>{setRows([{id:'P1',arrival:0,burst:1}]);$('algorithm').value='fcfs';$('quantum').value=2;run('Queue reset');});
function resizeProcesses(count){
  if(!Number.isInteger(count)||count<1||count>30){markDirty();$('error').textContent='Process count must be a whole number from 1 to 30.';$('error').hidden=false;return;}
  const rows=inputs().slice(0,count),used=new Set(rows.map(p=>p.id));
  while(rows.length<count){let id=1;while(used.has('P'+id))id++;used.add('P'+id);rows.push({id:'P'+id,arrival:0,burst:1,priority:1,queue:0});}
  setRows(rows);markDirty();
}
$('process-number').addEventListener('change',()=>resizeProcesses(numericValue($('process-number').value)));
$('process-number').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();resizeProcesses(numericValue($('process-number').value));}});
$('count-plus').addEventListener('click',()=>resizeProcesses($('process-inputs').children.length+1));
$('count-minus').addEventListener('click',()=>resizeProcesses($('process-inputs').children.length-1));

// Playback reads the complete schedule; it never changes final CT/TAT/WT/RT.
function pausePlayback(){
  if(playbackTimer!==null){window.clearInterval(playbackTimer);playbackTimer=null;}
  $('playback-play').textContent='Play';$('playback-play').setAttribute('aria-pressed','false');
}
function resetPlayback(result){
  pausePlayback();playbackModel=Scheduler.createPlayback(result);playbackTime=0;
  $('playback-controls').disabled=false;$('playback-time').max=result.makespan;
  $('playback-note').textContent='Processes are listed in input order. Next event jumps to an arrival, completion, CPU change or quantum boundary'+(SHOW_EXTRA_ALGORITHMS?', or MLFQ demotion.':'.');
  renderPlayback();
}
function playbackExplanation(state){
  const r=displayedResult,p=state.rows[state.running];
  if(state.time===r.makespan)return 'Every process has finished. Waiting so far now equals final WT for each process.';
  if(!p){const next=Math.min(...state.rows.filter(x=>x.status==='Not arrived').map(x=>x.arrival));return 'No process is ready. The CPU stays idle until the next arrival at time '+next+'.';}
  switch(r.algorithm){
    case 'fcfs':return p.id+' follows arrival order and runs until completion.';
    case 'sjf':return p.id+' was selected with burst '+p.burst+' as the shortest ready job at dispatch. It now runs to completion.';
    case 'srtf':return p.id+' has '+p.remaining+' units left, the smallest remaining burst among ready processes. Ties use arrival, then input order.';
    case 'priority':return p.id+' was selected with priority '+p.priority+' at dispatch and runs to completion. Smaller priority numbers run first.';
    case 'priority_p':return p.id+' runs with priority '+p.priority+'. Only a strictly higher-priority arrival can interrupt it; equal priority does not.';
    case 'hrrn':return 'At dispatch time '+(p.arrival+p.response)+', '+p.id+' had response ratio ('+p.response+' + '+p.burst+') / '+p.burst+' = '+number((p.response+p.burst)/p.burst)+'. The highest ready ratio was chosen; it runs to completion.';
    case 'rr':return p.id+' gets up to q='+r.quantum+' units per turn. At a slice boundary, arrivals enter the queue before an unfinished job is requeued.';
    case 'mlq':return p.id+' runs in Q'+p.level+(p.level===0?' with Round Robin, q='+r.quantum+'.':' with FCFS.')+' Q0 has priority over Q1; queue assignments stay fixed.';
    case 'mlfq':return p.id+' runs in Q'+p.level+' ('+(['RR, q='+r.quantum,'RR, q='+2*r.quantum,'FCFS'][p.level])+'). Unfinished jobs move down after their allowance; higher queues can interrupt lower queues.';
  }
}
function renderPlayback(){
  if(!playbackModel||!displayedResult)return;
  const state=playbackModel.at(playbackTime),r=displayedResult;
  $('playback-time').value=state.time;$('playback-clock').textContent=state.time+' / '+r.makespan;
  $('playback-cpu').textContent=state.time===r.makespan?'CPU: finished':state.running<0?'CPU: Idle':'CPU: '+state.rows[state.running].id;
  $('playback-counts').textContent=state.rows.filter(p=>p.status==='Ready').length+' ready · '+state.rows.filter(p=>p.status==='Completed').length+' completed';
  $('playback-explanation').textContent=playbackExplanation(state);
  const events=[];
  const arrivals=state.rows.filter(p=>p.arrival===state.time).map(p=>p.id);
  const completed=state.rows.filter(p=>p.completion===state.time).map(p=>p.id);
  if(arrivals.length)events.push('Arrived: '+arrivals.join(', '));
  if(completed.length)events.push('Completed: '+completed.join(', '));
  if(state.time>0){
    const previous=playbackModel.at(state.time-1),old=state.rows[previous.running];
    if(old&&old.remaining>0){
      if(r.algorithm==='mlfq'&&[r.quantum,3*r.quantum].includes(old.executed))events.push(old.id+' moved to Q'+old.level);
      else if((r.algorithm==='rr'||r.algorithm==='mlq'&&old.queue===0)&&old.executed%r.quantum===0)events.push(old.id+' finished a quantum and was requeued');
      else if(previous.running!==state.running)events.push(old.id+' paused with '+old.remaining+' units remaining');
    }
  }
  $('playback-events').textContent=events.length?events.join(' · '):state.time===r.makespan?'Simulation complete.':'Next event: time '+state.nextEvent+'.';
  $('playback-body').replaceChildren();
  state.rows.forEach(p=>{
    const tr=el('tr',undefined,p.status==='Running'?'playback-running':'');
    const detail=['mlq','mlfq'].includes(r.algorithm)?(p.status==='Completed'||p.status==='Not arrived'?'—':'Q'+p.level):['priority','priority_p'].includes(r.algorithm)?String(p.priority):'—';
    [p.id,p.status,p.executed,p.remaining,p.waitingSoFar,detail].forEach((value,i)=>{const td=el('td',String(value));td.dataset.label=['Process','State','CPU used','Remaining','Wait so far',(SHOW_EXTRA_ALGORITHMS?'Priority / queue':'Priority')][i];tr.append(td);});
    $('playback-body').append(tr);
  });
  $('playback-previous').disabled=state.time===0;
  for(const id of ['playback-next','playback-event','playback-play'])$(id).disabled=state.time===r.makespan;
  if(state.segmentIndex<timelineWindowStart||state.segmentIndex>=timelineWindowStart+400)renderTimeline(r,Math.floor(state.segmentIndex/400)*400);
  const track=$('gantt').children[0];
  if(track)[...track.children].forEach(node=>{node.className='gantt-segment'+(Number(node.dataset.segment)===state.segmentIndex&&state.time<r.makespan?' playback-active':'');});
}
function movePlayback(time){
  if(inputsChanged||$('playback-controls').disabled||!playbackModel)return;
  pausePlayback();playbackTime=Math.max(0,Math.min(displayedResult.makespan,Math.trunc(time)));renderPlayback();
}
function playPlayback(){
  if(playbackTimer!==null){pausePlayback();return;}
  if(inputsChanged||$('playback-controls').disabled||!displayedResult||playbackTime>=displayedResult.makespan)return;
  $('playback-play').textContent='Pause';$('playback-play').setAttribute('aria-pressed','true');
  playbackTimer=window.setInterval(()=>{playbackTime++;renderPlayback();if(playbackTime>=displayedResult.makespan)pausePlayback();},Number($('playback-speed').value));
}
$('playback-reset').addEventListener('click',()=>movePlayback(0));
$('playback-previous').addEventListener('click',()=>movePlayback(playbackTime-1));
$('playback-next').addEventListener('click',()=>movePlayback(playbackTime+1));
$('playback-event').addEventListener('click',()=>{if(playbackModel)movePlayback(playbackModel.at(playbackTime).nextEvent);});
$('playback-time').addEventListener('input',()=>movePlayback(Number($('playback-time').value)));
$('playback-play').addEventListener('click',playPlayback);
$('playback-speed').addEventListener('change',()=>{if(playbackTimer!==null){pausePlayback();playPlayback();}});
$('process-number').addEventListener('input',markDirty);

// Revalidate edited inputs before saving so a report cannot silently use old data.
function ensureReportResults(){
  if(typeof Scheduler==='undefined')return run();
  const current=inputs(),r=displayedResult;
  const unchanged=r&&current.length===r.rows.length&&current.every((p,i)=>['id','arrival','burst','priority','queue'].every(field=>p[field]===r.rows[i][field]));
  if(inputsChanged||!unchanged||numericValue($('process-number').value)!==current.length||numericValue($('quantum').value)!==r.quantum||$('algorithm').value!==r.algorithm||Scheduler.VERSION!=='20261003.9')return run();
  return true;
}
function csvCell(value){
  let text=String(value??'');
  // Quoting alone does not prevent spreadsheet formulas in user-entered IDs.
  if(typeof value==='string'&&/^(?:\s*[=+@-]|[\t\r\n])/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
function csvReport(result,all){
  const lines=[['Process Scheduler report'],['Algorithm',names[result.algorithm]],['Time quantum',result.quantum],['Quantum applies to',SHOW_EXTRA_ALGORITHMS?'Round Robin, MLQ and MLFQ':'Round Robin'],['Model','Single CPU; one burst per process; no I/O; zero switching overhead'],['Policy',descriptions[result.algorithm]],[],['Process results'],['Process','Arrival','Burst','Priority input','MLQ queue input','Completion (CT)','Turnaround (TAT)','Waiting (WT)','Response (RT)']];
  result.rows.forEach(p=>lines.push([p.id,p.arrival,p.burst,p.priority,p.queue,p.completion,p.turnaround,p.waiting,p.response]));
  for(const kind of ['totals','averages']){const v=result[kind];lines.push([kind==='totals'?'Total':'Average',v.arrival,v.burst,'','',v.completion,v.turnaround,v.waiting,v.response]);}
  lines.push([],['CPU statistics'],['Elapsed time',result.makespan],['Busy time',result.busy],['Idle time',result.idle],['CPU utilization (%)',result.utilization],['Throughput (processes/unit)',result.throughput],['Context switches',result.contextSwitches],['Context switch definition','Direct change between different processes; idle transitions and initial dispatch excluded'],[],['Algorithm comparison'],['Algorithm','Average CT','Average TAT','Average WT','Average RT','Context switches']);
  Object.entries(all).forEach(([key,r])=>lines.push([names[key],r.averages.completion,r.averages.turnaround,r.averages.waiting,r.averages.response,r.contextSwitches]));
  lines.push([],['Complete execution timeline'],['Type','Process','Start','End','Duration']);
  result.timeline.forEach(s=>lines.push([s.id===null?'Idle':'Process',s.id??'',s.start,s.end,s.end-s.start]));
  if(!SHOW_EXTRA_ALGORITHMS){const start=lines.findIndex(row=>row[0]==='Process results')+1;for(let i=start;i<=start+result.rows.length+2;i++)lines[i].splice(4,1);}
  return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
function exportCsv(){
  if(!ensureReportResults())return;
  const blob=new Blob([csvReport(displayedResult,lastResults)],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='process-scheduler-'+displayedResult.algorithm+'-report.csv';
  document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('report-status').textContent='CSV report prepared for download, including the complete timeline.';
}
function reportTable(headers,rows){
  const table=el('table'),head=el('thead'),heading=el('tr');
  headers.forEach(label=>{const th=el('th',label);th.setAttribute('scope','col');heading.append(th);});head.append(heading);table.append(head);
  const body=el('tbody');rows.forEach(row=>{const tr=el('tr');row.forEach(value=>tr.append(el('td',String(value))));body.append(tr);});table.append(body);return table;
}
function buildPrintReport(){
  const r=displayedResult,report=$('print-report');report.replaceChildren();
  report.append(el('h1','Process Scheduler — Results'),el('h2',names[r.algorithm]),el('p',descriptions[r.algorithm]));
  report.append(el('p','Single CPU · one burst per process · no I/O · zero switching overhead. '+(['rr','mlq','mlfq'].includes(r.algorithm)?'Quantum q = '+r.quantum+'. ':'')+'All times are abstract units.'));
  report.append(el('h3','Process inputs'),reportTable(['Process','Arrival','Burst','Priority input',...(SHOW_EXTRA_ALGORITHMS?['MLQ input queue']:[])],r.rows.map(p=>[p.id,p.arrival,p.burst,p.priority,...(SHOW_EXTRA_ALGORITHMS?['Q'+p.queue]:[])])));
  const fields=['arrival','burst','completion','turnaround','waiting','response'];
  const rows=r.rows.map(p=>[p.id,...fields.map(field=>p[field])]);
  for(const kind of ['totals','averages'])rows.push([kind==='totals'?'Total':'Average',...fields.map(field=>number(r[kind][field]))]);
  report.append(el('h3','Final process results'),reportTable(['Process','Arrival','Burst','CT','TAT','WT','RT'],rows));
  report.append(el('p','TAT = CT − arrival. WT = TAT − burst. RT = first start − arrival. Average = column total ÷ process count. Total CT is the sum of completion timestamps.'));
  report.append(el('p','Elapsed: '+r.makespan+' · Busy: '+r.busy+' · Idle: '+r.idle+' · CPU utilization: '+number(r.utilization)+'% · Throughput: '+r.throughput.toFixed(4)+' processes/unit · Context switches: '+r.contextSwitches+'.'));
  report.append(el('p','Context switches count direct changes between different running processes. Initial dispatch and transitions through Idle are excluded.'));
  report.append(el('h3','Execution timeline'));
  const chart=el('div',undefined,'print-timeline');r.timeline.slice(0,100).forEach(s=>{const chip=el('span',(s.id===null?'Idle':s.id)+' ['+s.start+'–'+s.end+']');chip.style.borderColor=color(s.index);chart.append(chip);});report.append(chart);
  report.append(el('p',r.timeline.length>100?'First 100 of '+r.timeline.length+' segments shown. All results use the complete schedule; export CSV for every segment.':'Intervals name the process and exact start–end times. Adjacent slices of the same process are merged.'));
  report.append(el('h3','Same-input comparison'),reportTable(['Algorithm','Avg. CT','Avg. TAT','Avg. WT','Avg. RT','Switches'],Object.entries(lastResults).map(([key,v])=>[names[key],number(v.averages.completion),number(v.averages.turnaround),number(v.averages.waiting),number(v.averages.response),v.contextSwitches])));
}
function printResults(){
  if(!ensureReportResults())return;
  pausePlayback();buildPrintReport();window.print();$('report-status').textContent='Use Save as PDF in the print dialog to save your report.';
}
$('export-csv').addEventListener('click',exportCsv);
$('print-results').addEventListener('click',printResults);
window.addEventListener('beforeprint',()=>{
  pausePlayback();
  if(ensureReportResults())buildPrintReport();
  else $('print-report').replaceChildren(el('h1','Process Scheduler'),el('p','No current report. Fix the input error on the website and run the simulation again.'));
});
configureAlgorithms();setRows(sample);run('Sample results');

// Refit the chart when rotating a device or resizing the browser.
if(typeof window!=='undefined'){
  let resizeQueued=false;
  window.addEventListener('resize',()=>{
    if(resizeQueued)return;resizeQueued=true;
    window.requestAnimationFrame(()=>{resizeQueued=false;if(displayedResult){renderTimeline(displayedResult);renderPlayback();}});
  });
}
