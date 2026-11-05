const DATA=window.QUIZ_DATA||[], $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
    const PDF_PREFIX='./data_set/';
    const WRONG_KEY='site-supervisor-wrong-v1', COMPLETED_KEY='site-supervisor-completed-v1', ATTEMPTS_KEY='site-supervisor-attempts-v1'; let current=null;
    const getAttempts=()=>Object.fromEntries(Object.entries(readStore(ATTEMPTS_KEY,{})).map(([id,a])=>[id,regradeAnswers(id,a)]));
    const getWrong=()=>correctedWrong();
    const saveWrong=x=>localStorage.setItem(WRONG_KEY,JSON.stringify(x));
    const getCompleted=()=>new Set([...readStore(COMPLETED_KEY,[]),...getWrong().map(x=>x.setId).filter(Boolean)]);
    const saveCompleted=id=>{const done=getCompleted();done.add(id);localStorage.setItem(COMPLETED_KEY,JSON.stringify([...done]));};
    const label=s=>s.replace(/_?試題|_?答案/g,'').replaceAll('_',' ');
    function refreshStats(){const w=getWrong();$('#setCount').textContent=DATA.length;$('#questionCount').textContent=DATA.reduce((n,x)=>n+x.questions.length,0).toLocaleString();$('#wrongCount').textContent=w.length;$('#wrongBadge').textContent=w.length?`(${w.length})`:'';}
    function fill(select,values,placeholder,display=v=>v){select.innerHTML=`<option value="">${placeholder}</option>`+values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(display(v))}</option>`).join('');}
    function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
    function splitQuestion(q,exam=current){
      const scenario=exam?.scenarios?.find(s=>s.id===q.scenarioId);
      return {scenario:scenario?.text||'',text:q.question||'',group:scenario};
    }
    function sourceImage(source,alt){
      if(!source?.image)return '';
      const img=`<a href="${escapeHtml('./data_set/'+source.image)}" target="_blank" title="開啟原圖放大查看"><img class="source-crop" loading="lazy" src="${escapeHtml('./data_set/'+source.image)}" alt="${escapeHtml(alt)}"></a>`;
      return source.hasGraphics?img:`<details class="source-detail"><summary>查看原卷情境（PDF 第 ${source.page} 頁）</summary>${img}</details>`;
    }
    function renderScenario(g){
      return `<div class="scenario"><span class="scenario-label">情境題 ${g.numbers.join('、')}</span>${g.source?.hasGraphics?'':`<div>${escapeHtml(g.text)}</div>`}${sourceImage(g.source,g.text)}</div>`;
    }
    function questionGroups(qs){
      const groups=[]; let current=null;
      qs.forEach((q,i)=>{
        const part=splitQuestion(q), key=q.scenarioId;
        if(key){
          if(!current||current.id!==key){current={id:key,scenario:part.scenario,group:part.group,items:[]};groups.push(current);}
          current.items.push({q,i,text:part.text});
        }else{current=null;groups.push({scenario:'',items:[{q,i,text:part.text}]});}
      });
      return groups;
    }
    function updateFilters(){
      const years=[...new Set(DATA.map(x=>x.year))].sort((a,b)=>Number(b)-Number(a)); fill($('#year'),years,'全部年份');
      const refreshSheets=()=>{const y=$('#year').value,s=$('#session').value; const sheets=DATA.filter(x=>(!y||x.year===y)&&(!s||x.session===s)).sort((a,b)=>Number(b.year)-Number(a.year)||Number(a.session.match(/第(\d+)次/)?.[1]||0)-Number(b.session.match(/第(\d+)次/)?.[1]||0)||a.sheet.localeCompare(b.sheet,'zh-Hant',{numeric:true})); fill($('#sheet'),sheets.map(x=>x.id),'請選擇試卷',sheetLabel); renderExamHistory();};
      $('#year').onchange=()=>{const y=$('#year').value; const ss=[...new Set(DATA.filter(x=>!y||x.year===y).map(x=>x.session))].sort((a,b)=>Number(b.match(/^(\d+)年/)?.[1]||0)-Number(a.match(/^(\d+)年/)?.[1]||0)||Number(a.match(/第(\d+)次/)?.[1]||0)-Number(b.match(/第(\d+)次/)?.[1]||0)); fill($('#session'),ss,'全部次數'); refreshSheets();};
      $('#session').onchange=refreshSheets;
      fill($('#session'),[], '請先選擇年份'); $('#year').onchange(); $('#sheet').onchange=renderExamHistory;
    }
    function renderQuiz(){
      showView('home');document.body.classList.add('quiz-mode');
      $('#year').value=current.year;$('#year').onchange();$('#sheet').value=current.id;renderExamHistory();
      const qs=current.questions; $('#quiz').hidden=false; $('#quiz').innerHTML=`<div class="quiz-top"><div><h2>${escapeHtml(current.session)}・${escapeHtml(label(current.sheet))}</h2><p>共 ${qs.length} 題｜<a class="source" href="${PDF_PREFIX}${encodeURI(current.pdf)}" target="_blank">開啟原始 PDF</a></p></div></div><div class="quiz-actions" role="region" aria-label="作答操作列"><div class="timer-block"><b id="timer">00:00</b><span id="runLabel"></span><small id="timerNote">／90:00</small></div><span id="answerProgress"></span><button class="secondary" id="backTop">回到選卷</button><button class="secondary" id="savePause">儲存並暫停</button><button class="primary" id="submit">交卷並檢討</button></div><div id="cards"></div>`;
      const renderQuestion=({q,i,text})=>{const opts=['A','B','C','D'].map(k=>{const val=q.options[k]||'（本題排版未完整擷取，請參考原始 PDF）';return `<label class="option ${q.options[k]?'':'missing'}"><input type="radio" name="q${i}" value="${k}"><span><b>${k}.</b> ${escapeHtml(val)}</span></label>`}).join('');return `<article class="card question" data-number="${q.number}"><div class="q-head"><span class="q-no">第 ${q.number} 題</span><div class="q-text">${escapeHtml(text||'請參考原始 PDF 題目')}</div></div>${renderMarkers(q)}${sourceImage(q.source,`第 ${q.number} 題原卷圖表與選項`)}${q.sourceNote?`<p class="source-note">${escapeHtml(q.sourceNote)}</p>`:''}<div class="options">${opts}</div></article>`;};
      $('#cards').innerHTML=questionGroups(qs).map(g=>g.group?`<section class="scenario-group">${renderScenario(g.group)}${g.items.map(renderQuestion).join('')}</section>`:g.items.map(renderQuestion).join('')).join('');
      $('#submit').onclick=submitQuiz; $('#backTop').onclick=()=>{if(run&&!run.submitted&&!pauseRun())return;showView('home');renderSavedProgress();$('#start').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});};
      $('#savePause').onclick=()=>run?.runningSince?pauseRun():resumeActive();
      window.quizBarObserver?.disconnect();
      const bar=$('.quiz-actions');
      const measureBar=()=>document.documentElement.style.setProperty('--quiz-bar-height',bar.getBoundingClientRect().height+'px');
      window.quizBarObserver=new ResizeObserver(measureBar);window.quizBarObserver.observe(bar);measureBar();
      restoreAnswers();bindQuizChanges();mountPaper();updateRunUI();
      const heading=$('#quiz h2');heading.tabIndex=-1;heading.focus({preventScroll:true});
      window.scrollTo({top:0,behavior:'instant'});
    }
    function answerSet(s){if(!s||s==='送分')return [];return s.replaceAll('或','、').replaceAll('/','、').split(/[、,\s]+/).filter(Boolean)}
    function optionLabel(q,keys){
      if(keys==='送分')return '送分題（自動計入答對）';
      const list=answerSet(keys); return list.length?list.map(k=>`${k}. ${q.options[k]||'（選項文字未擷取）'}`).join('；'):'未作答';
    }
    function markAnswerOptions(){
      current.questions.forEach((q,i)=>{
        const correct=answerSet(q.answer); document.querySelectorAll(`input[name=q${i}]`).forEach(input=>{const label=input.closest('label'); if(correct.includes(input.value))label.classList.add('answer-correct'); if(input.checked&&correct.length&&!correct.includes(input.value))label.classList.add('answer-wrong'); input.disabled=true;});
      });
    }
    function submitQuiz(){
      if(!run||run.submitted)return;
      captureAnswers();
      const remaining=current.questions.filter(q=>!run.answers[q.number]).length;
      if(!confirm(remaining?`尚有 ${remaining} 題未作答，確定要交卷嗎？`:'確定要交卷嗎？'))return;
      const wrong=[]; const attempts=[]; let answered=0; let unanswered=0; let bonus=0;
      current.questions.forEach((q,i)=>{
        const el=document.querySelector(`input[name=q${i}]:checked`); const chosen=el?el.value:''; const correct=answerSet(q.answer); const isBonus=q.answer==='送分'; const isCorrect=isBonus||(!!chosen&&correct.includes(chosen));
        if(chosen)answered++; else unanswered++; if(isBonus)bonus++;
        attempts.push({q,chosen,correct:q.answer,isBonus,isCorrect});
        if(!isBonus&&!isCorrect)wrong.push({key:`${current.id}-${q.number}`,setId:current.id,session:current.session,sheet:current.sheet,number:q.number,question:q.question,selected:chosen||'未作答',correct:q.answer,pdf:current.pdf,at:new Date().toISOString()});
      });
      if(!finishRun(attempts))return;
      const history=getAttempts(); history[current.id]=Object.fromEntries(attempts.map(a=>[a.q.number,{selected:a.chosen,correct:a.correct,isCorrect:a.isCorrect,isBonus:a.isBonus}])); localStorage.setItem(ATTEMPTS_KEY,JSON.stringify(history));
      const old=getWrong(); const merged=[...old.filter(x=>!wrong.some(y=>y.key===x.key)),...wrong]; saveWrong(merged); saveCompleted(current.id); const selectedOption=[...$('#sheet').options].find(o=>o.value===current.id); if(selectedOption)selectedOption.textContent=sheetLabel(current.id); refreshStats();
      renderResults(attempts,run);renderSavedProgress();renderExamHistory();
    }
    function reviewOptions(q,chosen){
      const correct=answerSet(q.answer);
      return ['A','B','C','D'].map(k=>`<label class="option ${correct.includes(k)?'answer-correct':''} ${q.answer!=='送分'&&chosen===k&&!correct.includes(k)?'answer-wrong':''}"><input type="radio" disabled ${chosen===k?'checked':''}><span><b>${k}.</b> ${escapeHtml(q.options[k]||'（本題選項未完整擷取，請參考原始 PDF）')}</span></label>`).join('');
    }
    function openAttemptReview(id,recordId){
      if(run&&!run.submitted&&!pauseRun())return;
      const exam=DATA.find(e=>e.id===id),record=getRuns(id).find(r=>r.id===recordId);
      if(!exam||!record)return;
      if(!record.answers){showView('wrong');refreshWrongFilters(id,recordId);renderWrong();return;}
      current=exam;
      run={...record,setId:id,submitted:true,runningSince:null,answers:Object.fromEntries(Object.entries(record.answers).map(([n,a])=>[n,a.selected||''])),flags:{...record.flags},checks:{...record.checks},paper:structuredClone(record.paper||[])};
      renderQuiz();
      const attempts=exam.questions.map(q=>{const a=record.answers[q.number];return {q,chosen:a?.selected||'',correct:q.answer,isBonus:q.answer==='送分',isCorrect:!!a?.isCorrect,unknown:!a};});
      renderResults(attempts,record);
    }
    function renderResults(attempts,record){
      const answered=attempts.filter(a=>a.chosen).length,unanswered=attempts.filter(a=>!a.chosen&&!a.unknown).length,bonus=attempts.filter(a=>a.isBonus).length;
      const score=attempts.filter(x=>x.isCorrect).length; const incorrect=attempts.filter(x=>!x.isBonus&&x.chosen&&!x.isCorrect).length; const result=document.createElement('div'); result.className='result'; result.innerHTML=`<h2 tabindex="-1">成績與檢討</h2><p>${escapeHtml(runName(record))}｜用時 ${record.elapsedMs==null?'未記錄':formatTime(record.elapsedMs)}</p><strong>得分 ${score*2}／${current.questions.length*2} 分</strong><p>答對 ${score-bonus} 題${bonus?`＋送分 ${bonus} 題`:""}／${current.questions.length} 題（每題 2 分）</p>${bonusNotice(current.questions)}<p class="encouragement">${encouragement(score*2,current.questions.length*2,answered)}</p><div class="sub">已作答 ${answered} 題，其中答錯 ${incorrect} 題；未作答 ${unanswered} 題。${record.corrected?'（依校正答案重新計分，原始紀錄保留。）':''}${attempts.some(a=>a.unknown)?'（舊紀錄不完整，無紀錄題目不推測作答。）':''}</div>`; $('#quiz .quiz-top').after(result);
      $('#submit').disabled=true; $('#submit').textContent='已完成'; markAnswerOptions(); updateRunUI();$('#runLabel').textContent=runName(record)+'・已交卷';if(record.elapsedMs==null)$('#timer').textContent='未記錄';
      const renderAttempt=({q,i,text})=>{const {chosen,isBonus,unknown}=attempts[i]; return `<article class="card question review-item" id="review-question-${i}" tabindex="-1"><div class="q-head"><span class="q-no">第 ${q.number} 題</span><div class="q-text">${escapeHtml(text)}</div></div>${unknown?'<p class="hint">無作答紀錄</p>':isBonus?'<p class="hint">送分題（自動獲得 2 分）</p>':''}${sourceImage(q.source,`第 ${q.number} 題原卷圖表`)}<div class="options">${reviewOptions(q,chosen)}</div></article>`;};
      const review=document.createElement('div'); review.className='review'; review.innerHTML='<h3>本次檢討（完整作答與正確答案）</h3>'+questionGroups(current.questions).map(g=>g.group?`<section class="scenario-group">${renderScenario(g.group)}${g.items.map(renderAttempt).join('')}</section>`:g.items.map(renderAttempt).join('')).join(''); $('#quiz').append(review);
      const overview=document.createElement('section');overview.id='reviewOverview';overview.className='card review-overview';overview.tabIndex=-1;
      overview.setAttribute('aria-label','答題結果一覽');
      overview.innerHTML='<h3>答題結果一覽</h3><p class="hint">點選題號查看下方檢討。○ 答對　✕ 答錯　— 未作答　★ 送分；⚑ 待檢查　✓ 已確認</p><div class="review-grid">'+attempts.map((a,i)=>{const state=a.unknown?'unanswered':a.isBonus?'bonus':a.isCorrect?'correct':a.chosen?'incorrect':'unanswered',symbol=a.unknown?'?':a.isBonus?'★':a.isCorrect?'○':a.chosen?'✕':'—',status=a.unknown?'無紀錄':a.isBonus?'送分':a.isCorrect?'答對':a.chosen?'答錯':'未作答';const flag=!!record.flags?.[a.q.number],check=!!record.checks?.[a.q.number],marks=[flag?'待檢查旗幟':'',check?'已確認勾選':''].filter(Boolean).join('，');return `<button type="button" class="review-jump ${state}" data-review-index="${i}" aria-label="第 ${a.q.number} 題，${status}${marks?'，'+marks:''}" aria-controls="review-question-${i}"><span>${a.q.number}</span><small>${symbol} ${status}</small><span class="overview-marks" aria-hidden="true">${flag?'<span data-snapshot-mark="flag">⚑</span>':''}${check?'<span data-snapshot-mark="check">✓</span>':''}</span></button>`;}).join('')+'</div>';
      result.after(overview);
      const jumpTo=el=>{el.focus({preventScroll:true});el.scrollIntoView({block:'start',behavior:'instant'});};
      overview.querySelectorAll('[data-review-index]').forEach(button=>button.onclick=()=>jumpTo(document.getElementById('review-question-'+button.dataset.reviewIndex)));
      const back=document.createElement('button');back.id='backOverview';back.type='button';back.className='primary';back.textContent='↑ 答題結果一覽';back.onclick=()=>jumpTo(overview);$('.quiz-actions').append(back);
      const retry=document.createElement('button');retry.id='retryExam';retry.type='button';retry.className='secondary';retry.textContent='再做一次';const reviewId=current.id;retry.onclick=()=>startExam(reviewId,true);$('.quiz-actions').insertBefore(retry,back);
      document.body.classList.add('review-mode');$('#cards').hidden=true;$('#paperPanel').hidden=true;$('#paperToggle').setAttribute('aria-expanded','false');result.querySelector('h2').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
    }
    function renderWrong(){
      const {list,history,record}=wrongSelection(),groups=new Map();
      for(const w of list.slice().reverse()){
        const exam=DATA.find(e=>e.id===w.setId),q=exam?.questions.find(q=>q.number===w.number);
        const scenario=q&&exam.scenarios?.find(s=>s.id===q.scenarioId);
        const key=JSON.stringify([w.setId,scenario?'scenario':'question',scenario?.id||w.number]);
        if(!groups.has(key))groups.set(key,{exam,scenario,w,items:scenario?exam.questions.filter(q=>q.scenarioId===scenario.id):q?[q]:[]});
      }
      $('#wrongList').innerHTML=groups.size?[...groups.values()].map(({exam,scenario,w,items})=>{
        const heading='';
        if(!exam||!items.length)return `<article class="card">${heading}<p>${escapeHtml(w.question)}</p><p>歷史錯題（目前題庫找不到此題）</p><p>你的答案：${escapeHtml(w.selected)}；正確答案：${escapeHtml(w.correct)}</p></article>`;
        const cards=items.map(q=>{
          const saved=history[exam.id]?.[q.number],old=list.find(x=>x.setId===exam.id&&x.number===q.number);
          const attempt=saved||(old?{selected:old.selected==='未作答'?'':old.selected,isCorrect:false}:null);
          const status=attempt?(attempt.isBonus?'送分':attempt.isCorrect?'答對':attempt.selected?'答錯':'未作答（列入錯題）'):'無作答明細（舊紀錄）';
          const color=attempt?(attempt.isCorrect?'right':'wrong'):'';
          const opts=reviewOptions(q,attempt?.selected);
          return `<article class="card question" data-question-number="${q.number}"><div class="q-head"><span class="q-no">第 ${q.number} 題</span><div class="q-text">${escapeHtml(q.question)}</div></div><p class="${color}"><b>${saved?(record?'本次作答：':'最近作答：'):''}${status}</b>${!record&&saved?.isCorrect&&old?'（曾列入錯題）':''}</p>${renderMarkers(q,exam)}${sourceImage(q.source,`第 ${q.number} 題原卷圖表`)}<div class="options">${opts}</div><p>你的答案：${attempt?escapeHtml(optionLabel(q,attempt.selected)):'無紀錄'}<br>正確答案：${escapeHtml(optionLabel(q,q.answer))}</p></article>`;
        }).join('');
        return `<section class="wrong-exam">${heading}${scenario?`<section class="scenario-group">${renderScenario(scenario)}${cards}</section>`:cards}<p><a class="source" href="${PDF_PREFIX}${encodeURI(exam.pdf)}" target="_blank">查看原始 PDF</a></p></section>`;
      }).join(''):'<div class="empty">這張試卷在所選範圍內沒有錯題。</div>';
    }
    $$('.tab').forEach(b=>b.onclick=()=>{
      if(b.dataset.view!=='home'&&run&&!run.submitted&&!pauseRun())return;
      showView(b.dataset.view);
      if(b.dataset.view==='wrong'){refreshWrongFilters();renderWrong();}
      if(b.dataset.view==='marked')renderMarked();
    });
    $('#start').onclick=()=>startExam($('#sheet').value);
    $('#clearWrong').onclick=()=>{
      if(!confirm('確定要清除所有錯題紀錄與作答紀錄嗎？包含儲存進度、旗幟、勾選、歷次成績與計時；此操作無法復原。'))return;
      localStorage.removeItem(WRONG_KEY);
      localStorage.removeItem(COMPLETED_KEY);
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem(DRAFTS_KEY);localStorage.removeItem(RUNS_KEY);localStorage.removeItem(MARKS_KEY);run=null;current=null;$('#quiz').hidden=true;
      for(const option of $('#sheet').options){if(option.value)option.textContent=option.value;}
      refreshStats();refreshWrongFilters();renderWrong();renderSavedProgress();renderExamHistory();renderMarked();syncMarkButtons();
    };
    document.addEventListener('DOMContentLoaded',()=>{updateFilters();refreshStats();renderSavedProgress();syncMarkButtons();});

// Keep previous keys intact. New records use stable exam and question IDs.
const DRAFTS_KEY='site-supervisor-drafts-v1', RUNS_KEY='site-supervisor-runs-v1', MARKS_KEY='site-supervisor-marks-v1';
const EXAM_MS=90*60*1000;
let run=null, noticeTimer;
function readStore(key,fallback){
  try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}
  catch{notify('無法讀取部分瀏覽器紀錄；請勿清除瀏覽器資料。');return fallback;}
}
function notify(message){
  const el=$('#notice');if(!el)return;
  el.textContent=message;el.hidden=false;clearTimeout(noticeTimer);
  noticeTimer=setTimeout(()=>{el.hidden=true;},6000);
}
function writeStore(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));return true;}
  catch{notify('儲存失敗：瀏覽器儲存空間不足或已停用。請保留此頁，尚未保存的答案仍在畫面中。');return false;}
}
function storedRuns(id){
  const all=readStore(RUNS_KEY,{});
  if(Object.hasOwn(all,id))return all[id];
  // Earlier versions retained only the latest answers, never invent earlier attempts.
  const answers=readStore(ATTEMPTS_KEY,{})[id];
  if(answers)return [{id:'legacy',ordinal:null,legacy:true,answers,elapsedMs:null,submittedAt:null}];
  if(getCompleted().has(id))return [{id:'legacy',ordinal:null,legacy:true,answers:null,elapsedMs:null,submittedAt:null}];
  return [];
}
function getRuns(id){return storedRuns(id).map(rec=>regradeRecord(id,rec));}
const runName=r=>r.legacy?'舊版作答（次數不詳）':`第 ${r.ordinal} 次作答`;
function nextOrdinal(id){return Math.max(0,...getRuns(id).filter(x=>!x.legacy).map(x=>x.ordinal))+1;}
function sheetLabel(id){
  const n=getRuns(id).filter(x=>!x.legacy).length,old=getRuns(id).some(x=>x.legacy);
  return `${id}${n?`（已作答 ${n} 次${old?'＋舊紀錄':''}）`:old?'（舊版已作答）':''}${readStore(DRAFTS_KEY,{})[id]?'・有儲存進度':''}`;
}
function formatTime(ms){const sec=Math.floor(Math.max(0,ms||0)/1000);return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;}
function elapsed(){return (run?.elapsedMs||0)+(run?.runningSince?Math.max(0,Date.now()-run.runningSince):0);}
function captureAnswers(){
  if(!run||run.submitted||!current)return;
  syncRunMarks();
  current.questions.forEach((q,i)=>{const el=$(`input[name="q${i}"]:checked`);run.answers[q.number]=el?.value||'';});
}
function persistRun(){
  if(!run||run.submitted)return true;
  captureAnswers();
  const drafts=readStore(DRAFTS_KEY,{});
  // Store a paused checkpoint; closing/reloading never counts time away from the page.
  drafts[current.id]={...run,elapsedMs:elapsed(),runningSince:null,savedAt:new Date().toISOString()};
  return writeStore(DRAFTS_KEY,drafts);
}
function pauseRun(){
  if(!run||run.submitted)return true;
  if(!persistRun())return false;
  run.elapsedMs=elapsed();run.runningSince=null;updateRunUI();renderSavedProgress();
  notify('進度已儲存，計時暫停。下次可從「繼續作答」接續。');return true;
}
function resumeActive(){
  if(!run||run.submitted)return;
  run.runningSince=Date.now();updateRunUI();persistRun();
}
function startExam(id,fresh=false){
  const exam=DATA.find(e=>e.id===id);if(!exam){notify('請先選擇試卷。');return;}
  const draft=readStore(DRAFTS_KEY,{})[id];
  if(fresh&&!confirm(draft?'這張試卷已有未完成的進度。重新作答將取代該進度，確定要再做一次嗎？':'確定要再做一次嗎？將重新開始同一張試卷，答案與計時會歸零，歷次成績仍會保留。'))return;
  if(run&&!run.submitted&&!pauseRun())return;
  if(draft&&!fresh){resumeExam(id);return;}
  current=exam;
  run={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,setId:id,ordinal:nextOrdinal(id),answers:{},flags:{},checks:{},elapsedMs:0,runningSince:Date.now(),startedAt:new Date().toISOString(),submitted:false};
  renderQuiz();persistRun();renderSavedProgress();
}
function resumeExam(id){
  if(run&&!run.submitted&&!pauseRun())return;
  const draft=readStore(DRAFTS_KEY,{})[id],exam=DATA.find(e=>e.id===id);
  if(!draft||!exam)return;
  // A completed run can leave a draft only if storage cleanup failed.
  if(getRuns(id).some(x=>x.id===draft.id)){
    notify('這份進度已交卷，請從作答紀錄查看。');return;
  }
  current=exam;run={...draft,runningSince:Date.now(),submitted:false};
  showView('home');renderQuiz();persistRun();
}
function restoreAnswers(){
  if(!run)return;
  syncRunMarks();
  current.questions.forEach((q,i)=>{$$(`input[name="q${i}"]`).forEach(el=>{el.checked=el.value===run.answers[q.number];});});
}
function renderMarkers(q,exam=current){
  const m=getMarks()[`${exam.id}-${q.number}`]||{};
  return `<div class="question-marks">${[['flags','flag','⚑','待檢查旗幟'],['checks','check','✓','已確認']].map(([type,cls,symbol,title])=>`<button type="button" class="mark ${cls}" data-mark="${type}" data-exam="${escapeHtml(exam.id)}" data-q="${q.number}" title="${title}" aria-label="第 ${q.number} 題${title}" aria-pressed="${!!m[type]}">${symbol}</button>`).join('')}</div>`;
}
function bindQuizChanges(){
  $('#cards').onchange=()=>{captureAnswers();persistRun();updateRunUI();};
}
function updateRunUI(){
  if(!run||!$('#timer'))return;
  window.updatePaperState?.();
  const ms=elapsed(),paused=!run.runningSince&&!run.submitted;
  $('#timer').textContent=formatTime(ms);
  $('#timer').classList.toggle('overtime',ms>=EXAM_MS);
  $('#runLabel').textContent=`第 ${run.ordinal} 次${run.submitted?'・已交卷':paused?'・已暫停':''}`;
  $('#timerNote').textContent=ms>=EXAM_MS?'已達 90 分鐘，請留意交卷':'／90:00';
  $('#answerProgress').textContent=`已答 ${Object.values(run.answers).filter(Boolean).length}/${current.questions.length}｜⚑ ${Object.values(run.flags).filter(Boolean).length}｜✓ ${Object.values(run.checks).filter(Boolean).length}`;
  $('#savePause').textContent=paused?'繼續作答':'儲存並暫停';
  $('#savePause').disabled=run.submitted;$('#submit').disabled=run.submitted;
  $$('#cards input,#cards [data-mark]').forEach(el=>{el.disabled=paused||run.submitted;});
  if(ms>=EXAM_MS&&!run.timeNotified&&!run.submitted){run.timeNotified=true;notify('已達考試時間 90 分鐘。進度會繼續保存，請完成檢查後交卷。');}
}
function finishRun(attempts){
  const records=storedRuns(current.id);
  if(records.some(x=>x.id===run.id)){notify('這次作答已交卷，請重新選卷開始。');return false;}
  const all=readStore(RUNS_KEY,{}),ms=elapsed();
  const answers=Object.fromEntries(attempts.map(a=>[a.q.number,{selected:a.chosen,correct:a.correct,isCorrect:a.isCorrect,isBonus:a.isBonus}]));
  all[current.id]=[...records,{id:run.id,ordinal:run.ordinal,answers,paper:run.paper||[],flags:{...run.flags},checks:{...run.checks},elapsedMs:ms,submittedAt:new Date().toISOString(),score:attempts.filter(a=>a.isCorrect).length,total:attempts.length,points:attempts.filter(a=>a.isCorrect).length*2,maxPoints:attempts.length*2,answerVersion:'V2.3'}];
  if(!writeStore(RUNS_KEY,all))return false;
  run.elapsedMs=ms;run.runningSince=null;run.submitted=true;
  const drafts=readStore(DRAFTS_KEY,{});delete drafts[current.id];writeStore(DRAFTS_KEY,drafts);
  return true;
}
function renderSavedProgress(){
  const drafts=readStore(DRAFTS_KEY,{}),entries=Object.entries(drafts).filter(([id,d])=>DATA.some(e=>e.id===id)&&!getRuns(id).some(x=>x.id===d.id));
  $('#savedProgress').innerHTML='<h3>儲存中的作答</h3>'+(entries.length?entries.map(([id,d])=>`<div class="saved-row"><div><b>${escapeHtml(id)}</b><div>第 ${d.ordinal} 次・已答 ${Object.values(d.answers).filter(Boolean).length} 題・累計 ${formatTime(d.elapsedMs)}</div></div><button class="primary" data-resume="${escapeHtml(id)}">繼續作答</button></div>`).join(''):'<p class="hint">尚無未完成的作答。作答時自動儲存，也可隨時儲存並暫停。</p>');
  $$('#savedProgress [data-resume]').forEach(b=>b.onclick=()=>resumeExam(b.dataset.resume));
}
function renderExamHistory(){
  const id=$('#sheet').value,records=id?getRuns(id):[],el=$('#examHistory');
  el.hidden=!id;
  el.innerHTML='<h3>這張試卷的作答紀錄</h3>'+(records.length?records.slice().reverse().map(rec=>`<div class="saved-row"><div><b>${runName(rec)}</b><div>${rec.legacy?'舊版只保留最近一次答案；新增次數另從第 1 次起算':`${new Date(rec.submittedAt).toLocaleString('zh-TW')}・得分 ${rec.score*2}/${rec.total*2} 分・答對 ${rec.score}/${rec.total} 題${rec.corrected?'（依 V2.3 答案重算，原紀錄保留）':''}・用時 ${formatTime(rec.elapsedMs)}`}</div></div><button class="secondary" data-history="${escapeHtml(rec.id)}">${rec.answers?'查看成績與檢討':'查看舊錯題'}</button></div>`).join(''):'<p>尚未交卷；完成後會保留每次成績。</p>');
  $$('#examHistory [data-history]').forEach(b=>b.onclick=()=>openAttemptReview(id,b.dataset.history));
}
function showView(name){
  document.body.classList.remove('quiz-mode','review-mode');$('#quiz').hidden=true;
  $$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
  $$('.view').forEach(x=>x.classList.toggle('active',x.id===name));
}
function refreshWrongFilters(id=$('#wrongExam').value,recordId=$('#wrongRun').value){
  const available=DATA.filter(e=>getRuns(e.id).length||getWrong().some(w=>w.setId===e.id));
  $('#wrongExam').innerHTML=available.map(e=>`<option value="${escapeHtml(e.id)}">${escapeHtml(e.id)}</option>`).join('');
  if(available.some(e=>e.id===id))$('#wrongExam').value=id;
  const records=getRuns($('#wrongExam').value);
  $('#wrongRun').innerHTML='<option value="">歷次累積錯題</option>'+records.slice().reverse().map(rec=>`<option value="${escapeHtml(rec.id)}">${runName(rec)}</option>`).join('');
  if(records.some(rec=>rec.id===recordId))$('#wrongRun').value=recordId;
  $('#wrongExam').onchange=()=>{refreshWrongFilters($('#wrongExam').value,'');renderWrong();};
  $('#wrongRun').onchange=renderWrong;
}
function wrongSelection(){
  const id=$('#wrongExam').value,record=getRuns(id).find(x=>x.id===$('#wrongRun').value);
  const exam=DATA.find(e=>e.id===id);
  let list=getWrong().filter(w=>w.setId===id),history=getAttempts();
  if(record?.answers&&exam){
    history={[id]:record.answers};
    list=exam.questions.filter(q=>record.answers[q.number]&&!record.answers[q.number].isCorrect&&!record.answers[q.number].isBonus).map(q=>({setId:id,session:exam.session,sheet:exam.sheet,number:q.number,selected:record.answers[q.number].selected,correct:q.answer}));
  }
  $('#wrongSummary').textContent=exam?`${label(exam.id)}｜${record?runName(record):'歷次累積錯題'}｜錯題 ${list.length} 題；情境題會一併列出同組小題。`:'尚未有作答紀錄。';
  if(record?.answers&&exam){
    const detail=document.createElement('details');detail.className='attempt-detail';
    detail.innerHTML=`<summary>查看本次全部答案與標記（${exam.questions.length} 題）</summary><div class="answer-grid">${exam.questions.map(q=>{const a=record.answers[q.number];return `<div>第 ${q.number} 題：${escapeHtml(a?.selected||'未作答')} → ${escapeHtml(q.answer)} <b class="${a?.isCorrect?'right':'wrong'}">${a?.isCorrect?'答對':'答錯／未作答'}</b> ${record.flags?.[q.number]?'⚑':''}${record.checks?.[q.number]?'✓':''}</div>`;}).join('')}</div>`;
    if(record.corrected){const note=document.createElement('p');note.textContent='此紀錄依 V2.3 校正答案重新判定；原始作答與交卷快照仍保留。';$('#wrongSummary').append(note);}
    $('#wrongSummary').append(detail);
  }
  return {list,history,record};
}
// Checkpoint every five seconds; visibility/pagehide also checkpoints and pauses.
setInterval(()=>{if(run&&!run.submitted&&run.runningSince){updateRunUI();if(Date.now()-(run.lastCheckpoint||0)>5000){persistRun();run.lastCheckpoint=Date.now();}}},1000);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&run&&!run.submitted){pauseRun();}
});
window.addEventListener('pagehide',()=>{if(run&&!run.submitted)pauseRun();});
window.addEventListener('beforeunload',e=>{
  if(run&&!run.submitted&&!persistRun()){e.preventDefault();e.returnValue='';}
});

// Current per-question markers are shared across views; submitted snapshots stay immutable.
function getMarks(){
  const saved=readStore(MARKS_KEY,null);
  if(saved!==null)return saved;
  const marks={},records=[];
  for(const [id,rows] of Object.entries(readStore(RUNS_KEY,{}))){
    for(const row of rows)records.push({id,row,at:row.submittedAt||''});
  }
  for(const [id,row] of Object.entries(readStore(DRAFTS_KEY,{})))records.push({id,row,at:row.savedAt||row.startedAt||''});
  records.sort((a,b)=>a.at.localeCompare(b.at));
  for(const {id,row} of records){
    for(const type of ['flags','checks']){
      for(const [number,value] of Object.entries(row[type]||{})){
        const key=`${id}-${number}`;
        marks[key]={...marks[key],[type]:!!value};
      }
    }
  }
  return marks;
}
function syncRunMarks(){
  if(!run||run.submitted||!current)return;
  const marks=getMarks();
  current.questions.forEach(q=>{
    const m=marks[`${current.id}-${q.number}`]||{};
    run.flags[q.number]=!!m.flags;run.checks[q.number]=!!m.checks;
  });
}
function syncMarkButtons(){
  const marks=getMarks();
  $$('[data-mark]').forEach(b=>b.setAttribute('aria-pressed',String(!!marks[`${b.dataset.exam}-${b.dataset.q}`]?.[b.dataset.mark])));
  const count=DATA.reduce((n,e)=>n+e.questions.filter(q=>{const m=marks[`${e.id}-${q.number}`];return m?.flags||m?.checks;}).length,0);
  $('#markedBadge').textContent=count?`(${count})`:'';
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-mark]');if(!b||b.disabled)return;
  const id=b.dataset.exam,n=b.dataset.q,type=b.dataset.mark;
  if(!['flags','checks'].includes(type))return;
  const marks=getMarks(),key=`${id}-${n}`;
  marks[key]={...marks[key],[type]:!marks[key]?.[type]};
  if(!writeStore(MARKS_KEY,marks))return;
  if(run&&!run.submitted&&current?.id===id){syncRunMarks();persistRun();updateRunUI();}
  syncMarkButtons();
  if($('#marked').classList.contains('active')){
    renderMarked();
    // If this was the last mark, move keyboard focus to the filter instead of losing it.
    const next=$$('#markedList [data-mark]').find(x=>x.dataset.exam===id&&x.dataset.q===n&&x.dataset.mark===type);
    (next||$('#markedType')).focus({preventScroll:true});
  }
});
function renderMarked(){
  const marks=getMarks(),selected=$('#markedExam').value,type=$('#markedType').value;
  const hasMark=(e,q)=>{const m=marks[`${e.id}-${q.number}`];return !!(m&&(type?m[type]:m.flags||m.checks));};
  const exams=DATA.filter(e=>e.questions.some(q=>{const m=marks[`${e.id}-${q.number}`];return m?.flags||m?.checks;}));
  fill($('#markedExam'),exams.map(e=>e.id),'全部試卷');
  if(exams.some(e=>e.id===selected))$('#markedExam').value=selected;
  const groups=exams.filter(e=>!$('#markedExam').value||e.id===$('#markedExam').value)
    .map(exam=>({exam,questions:exam.questions.filter(q=>hasMark(exam,q))})).filter(g=>g.questions.length);
  const count=groups.reduce((n,g)=>n+g.questions.length,0);
  $('#markedSummary').textContent=`共 ${count} 題；同時有兩種標記的題目只列一次。`;
  $('#markedList').innerHTML=groups.length?groups.map(({exam,questions})=>{
    const sections=new Map();
    for(const q of questions){
      const scenario=exam.scenarios?.find(g=>g.id===q.scenarioId),key=scenario?`s:${scenario.id}`:`q:${q.number}`;
      if(!sections.has(key))sections.set(key,{scenario,items:[]});
      sections.get(key).items.push(q);
    }
    const card=q=>`<article class="card question" data-exam="${escapeHtml(exam.id)}" data-question-number="${q.number}"><div class="q-head"><span class="q-no">第 ${q.number} 題</span><div class="q-text">${escapeHtml(q.question)}</div></div>${renderMarkers(q,exam)}${sourceImage(q.source,`第 ${q.number} 題原卷圖表`)}<div class="options">${['A','B','C','D'].map(k=>`<div class="option"><span><b>${k}.</b> ${escapeHtml(q.options[k]||'請參考原卷')}</span></div>`).join('')}</div><details class="source-detail"><summary>查看正確答案</summary>${escapeHtml(optionLabel(q,q.answer))}</details></article>`;
    return `<section class="marked-exam"><h3>${escapeHtml(label(exam.id))}</h3>${[...sections.values()].map(g=>g.scenario?`<section class="scenario-group">${renderScenario(g.scenario)}${g.items.map(card).join('')}</section>`:g.items.map(card).join('')).join('')}<a class="source" href="${PDF_PREFIX}${encodeURI(exam.pdf)}" target="_blank">查看原始 PDF</a></section>`;
  }).join(''):'<div class="empty">目前沒有符合條件的標記題目。</div>';
  $('#markedExam').onchange=renderMarked;$('#markedType').onchange=renderMarked;
  syncMarkButtons();
}

function encouragement(points,maxPoints,answered){
  if(!answered)return '先從完成一題開始，再逐步建立信心。準備好後，隨時可以再練習！';
  if(points===maxPoints)return '本次獲得滿分！持續複習，把理解累積成穩定的實力。';
  if(points>=maxPoints*.8)return '掌握得不錯！再把這次錯題釐清，下一次會更穩定。';
  if(points>=maxPoints*.6)return '你已經累積了不少正確觀念，逐題補強不熟悉的部分，繼續加油！';
  return '完成練習就是進步的開始。把錯題拆成小目標，一題一題理解，慢慢累積實力。';
}
// Derive corrected views without modifying the original stored submission snapshots.
function regradeAnswers(id,answers){
  if(!id.startsWith('112年第3次-')||!answers)return answers;
  const exam=DATA.find(e=>e.id===id);if(!exam)return answers;
  const result={...answers};
  for(const q of exam.questions){
    const a=answers[q.number];if(!a)continue;
    const selected=a.selected==='未作答'?'':a.selected||'',isBonus=q.answer==='送分';
    result[q.number]={...a,selected,correct:q.answer,isBonus,isCorrect:isBonus||answerSet(q.answer).includes(selected)};
  }
  return result;
}
function regradeRecord(id,record){
  const answers=regradeAnswers(id,record.answers);
  if(answers===record.answers)return record;
  const corrected=Object.keys(answers).some(n=>answers[n].isCorrect!==record.answers[n].isCorrect||answers[n].correct!==record.answers[n].correct);
  const complete=DATA.find(e=>e.id===id)?.questions.every(q=>answers[q.number]);
  return {...record,answers,corrected,originalScore:record.score,
    ...(complete?{score:Object.values(answers).filter(a=>a.isCorrect).length,total:Object.keys(answers).length}:{} )};
}
function correctedWrong(){
  const raw=readStore(WRONG_KEY,[]),rows=new Map();
  const examById=new Map(DATA.map(e=>[e.id,e]));
  const add=(exam,q,selected,at)=>{
    const isBonus=q.answer==='送分';
    if(isBonus||answerSet(q.answer).includes(selected))return;
    const key=`${exam.id}-${q.number}`;
    rows.set(key,{key,setId:exam.id,session:exam.session,sheet:exam.sheet,number:q.number,question:q.question,selected:selected||'未作答',correct:q.answer,pdf:exam.pdf,at});
  };
  for(const w of raw){
    if(!w.setId?.startsWith('112年第3次-')){rows.set(w.key,w);continue;}
    const exam=examById.get(w.setId),q=exam?.questions.find(q=>q.number===w.number);
    if(!q){rows.set(w.key,w);continue;}
    add(exam,q,w.selected==='未作答'?'':w.selected,w.at);
  }
  // Bring in newly discovered wrong answers even if the old answer key called them correct.
  const latest=readStore(ATTEMPTS_KEY,{}),runs=readStore(RUNS_KEY,{});
  for(const exam of DATA.filter(e=>e.id.startsWith('112年第3次-'))){
    for(const record of [...(runs[exam.id]||[]),{answers:latest[exam.id]}]){
      if(!record.answers)continue;
      for(const q of exam.questions){
        const a=record.answers[q.number];if(a)add(exam,q,a.selected==='未作答'?'':a.selected,record.submittedAt);
      }
    }
  }
  return [...rows.values()];
}

function bonusNotice(questions){
  const numbers=questions.filter(q=>q.answer==='送分').map(q=>q.number);
  return numbers.length?`<div class="bonus-notice" role="note"><b>送分題：第 ${numbers.join('、')} 題</b><br>共 ${numbers.length} 題，每題 2 分，合計 ${numbers.length*2} 分已計入總分；無論是否作答均給分。</div>`:'';
}

// Unbounded world coordinates; the canvas element is only a viewport.
function mountPaper(){
  window.paperCleanup?.();
  run.paper=Array.isArray(run.paper)?run.paper:[];
  const owner=run,redo=[],pointers=new Map();
  let mode='pen',stroke=null,gesture=null,pan=null,blocked=false,saveTimer;
  let view=owner.paperView&&['x','y','scale'].every(k=>Number.isFinite(owner.paperView[k]))&&owner.paperView.scale>0?{...owner.paperView}:null,w=0,h=0;
  const toggle=document.createElement('button');toggle.id='paperToggle';toggle.className='secondary';toggle.textContent='計算紙';
  toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','paperPanel');
  $('.quiz-actions').insertBefore(toggle,$('#backTop'));
  const icons={pen:'<path d="m4 16 12-12 4 4-12 12-5 1zM13 7l4 4"/>',eraser:'<path d="m4 13 9-9 7 7-9 9H8zM8 9l7 7M11 20h10"/>',hand:'<path d="M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2"/>',undo:'<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',redo:'<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8m-4-4v8"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',minus:'<path d="M5 12h14"/>',plus:'<path d="M5 12h14M12 5v14"/>'};
  const button=(id,label,icon)=>`<button id="${id}" class="secondary paper-icon" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[icon]}</svg></button>`;
  const panel=document.createElement('aside');panel.id='paperPanel';panel.hidden=true;panel.setAttribute('aria-label','計算紙');
  panel.innerHTML=`<div class="paper-stage"><canvas id="paperCanvas" aria-label="書寫區；單指書寫，雙指平移縮放">此瀏覽器不支援畫布。</canvas></div><p id="paperStatus" role="status"></p><div class="paper-tools" role="group" aria-label="計算紙工具">${button('paperPen','筆','pen')}${button('paperEraser','橡皮擦','eraser')}${button('paperPan','移動畫布','hand')}${button('paperUndo','復原','undo')}${button('paperRedo','重做','redo')}${button('paperClear','清空計算紙','trash')}${button('paperDownload','下載全部筆跡圖片','download')}${button('paperZoomOut','縮小','minus')}<output id="paperZoom" aria-label="縮放比例"></output>${button('paperZoomIn','放大','plus')}${button('paperFit','回到全部筆跡','fit')}</div>`;
  $('#quiz').append(panel);
  const canvas=$('#paperCanvas'),ctx=canvas.getContext('2d');
  const editable=()=>run===owner&&!owner.submitted&&!!owner.runningSince;
  const bounds=()=>{let x=Infinity,y=Infinity,X=-Infinity,Y=-Infinity;for(const s of owner.paper){for(const p of s.points){x=Math.min(x,p[0]-s.width);y=Math.min(y,p[1]-s.width);X=Math.max(X,p[0]+s.width);Y=Math.max(Y,p[1]+s.width);}}return Number.isFinite(x)?{x,y,X,Y}:null;};
  const draw=(c,ink='#1d1d1f')=>{for(const s of owner.paper){c.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';c.strokeStyle=c.fillStyle=ink;c.lineWidth=s.width;c.lineCap=c.lineJoin='round';c.beginPath();s.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();if(s.points.length===1){c.beginPath();c.arc(...s.points[0],s.width/2,0,Math.PI*2);c.fill();}}c.globalCompositeOperation='source-over';};
  const paint=()=>{
    if(!view||!w||!h)return;
    const d=canvas.width/w;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(d*view.scale,0,0,d*view.scale,d*view.x,d*view.y);draw(ctx,getComputedStyle(canvas).color);
    $('#paperZoom').textContent=Math.round(view.scale*100)+'%';
  };
  const status=()=>{
    if(run!==owner)return;
    $('#paperStatus').textContent=owner.submitted?'已交卷：可移動、縮放及下載筆跡。':!owner.runningSince?'已暫停：可移動縮放，續答後可書寫。':'單指寫字；雙指移動／縮放。電腦可用手掌工具拖曳、滾輪縮放。';
    for(const id of ['paperPen','paperEraser','paperClear'])$('#'+id).disabled=!editable();
    $('#paperUndo').disabled=!editable()||!owner.paper.length;$('#paperRedo').disabled=!editable()||!redo.length;
    for(const [id,m] of [['paperPen','pen'],['paperEraser','eraser'],['paperPan','pan']])$('#'+id).setAttribute('aria-pressed',String(mode===m));
    canvas.style.cursor=mode==='pan'||!editable()?'grab':'crosshair';
  };
  const save=()=>{clearTimeout(saveTimer);if(run!==owner||owner.submitted)return;if(view)owner.paperView={...view};if(!persistRun())$('#paperStatus').textContent='筆跡尚未儲存，請保留本頁並下載圖片備份。';};
  const finish=()=>{if(stroke)redo.length=0;stroke=null;status();save();};
  const cancelPointers=()=>{stroke=null;gesture=pan=null;blocked=false;const ids=[...pointers.keys()];pointers.clear();for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);};
  const fit=()=>{const b=bounds();view=b?{scale:Math.min(20,Math.max(.05,Math.min((w-32)/Math.max(1,b.X-b.x),(h-32)/Math.max(1,b.Y-b.y)))),x:0,y:0}:{scale:1,x:w/2,y:h/2};if(b){view.x=w/2-(b.x+b.X)/2*view.scale;view.y=h/2-(b.y+b.Y)/2*view.scale;}paint();save();};
  const observer=new ResizeObserver(()=>{
    const stage=canvas.parentElement,nw=stage.clientWidth,nh=stage.clientHeight;if(!nw||!nh)return;
    if(view&&w&&h){view.x+=(nw-w)/2;view.y+=(nh-h)/2;}w=nw;h=nh;
    const d=Math.min(devicePixelRatio||1,3);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);
    if(!view){if(owner.paper.length){fit();}else{view={scale:1,x:w/2,y:h/2};}}
    paint();
  });observer.observe(canvas.parentElement);
  const pos=e=>{const b=canvas.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top};};
  const world=p=>[(p.x-view.x)/view.scale,(p.y-view.y)/view.scale];
  const pair=()=>{const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))};};
  canvas.onpointerdown=e=>{
    if(e.button!==0||!view)return;e.preventDefault();pointers.set(e.pointerId,pos(e));canvas.setPointerCapture(e.pointerId);
    if(pointers.size===2){if(stroke){owner.paper.pop();stroke=null;paint();}pan=null;const p=pair();gesture={...p,world:world(p),scale:view.scale};blocked=true;return;}
    if(pointers.size!==1||blocked)return;
    if(mode==='pan'||!editable()){pan={point:pos(e),x:view.x,y:view.y};return;}
    if(owner.paper.reduce((n,s)=>n+s.points.length,0)>=20000){notify('筆跡儲存已達容量限制，請下載後清空再繼續。');return;}
    stroke={tool:mode,width:mode==='eraser'?24:3,points:[world(pos(e))]};owner.paper.push(stroke);paint();
  };
  canvas.onpointermove=e=>{
    if(!pointers.has(e.pointerId))return;e.preventDefault();pointers.set(e.pointerId,pos(e));
    if(gesture&&pointers.size>=2){const p=pair();view.scale=Math.max(.05,Math.min(20,gesture.scale*p.d/gesture.d));view.x=p.x-gesture.world[0]*view.scale;view.y=p.y-gesture.world[1]*view.scale;paint();return;}
    if(blocked)return;
    if(pan){const p=pos(e);view.x=pan.x+p.x-pan.point.x;view.y=pan.y+p.y-pan.point.y;paint();return;}
    if(!stroke)return;if(!editable()){finish();return;}
    const p=world(pos(e)),last=stroke.points.at(-1);if(Math.hypot(p[0]-last[0],p[1]-last[1])*view.scale<1.5)return;
    if(stroke.points.length>=2000){finish();return;}stroke.points.push(p);paint();
  };
  const end=e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);if(stroke)redo.length=0;finish();
    if(!pointers.size){gesture=pan=null;blocked=false;}
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  };
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=end;
  const zoom=(factor,p={x:w/2,y:h/2})=>{if(!view)return;const q=world(p);view.scale=Math.max(.05,Math.min(20,view.scale*factor));view.x=p.x-q[0]*view.scale;view.y=p.y-q[1]*view.scale;paint();};
  canvas.addEventListener('wheel',e=>{e.preventDefault();if(pointers.size)return;zoom(Math.exp(-Math.max(-200,Math.min(200,e.deltaY))*.003),pos(e));clearTimeout(saveTimer);saveTimer=setTimeout(save,250);},{passive:false});
  toggle.onclick=()=>{finish();cancelPointers();panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));status();};

  panel.onkeydown=e=>{if(e.key==='Escape'&&!panel.hidden){toggle.click();toggle.focus();}};
  for(const [id,m] of [['paperPen','pen'],['paperEraser','eraser'],['paperPan','pan']])$('#'+id).onclick=()=>{finish();cancelPointers();mode=m;status();};
  $('#paperUndo').onclick=()=>{finish();if(owner.paper.length)redo.push(owner.paper.pop());paint();status();save();};
  $('#paperRedo').onclick=()=>{finish();if(redo.length)owner.paper.push(redo.pop());paint();status();save();};
  $('#paperClear').onclick=()=>{finish();if(!owner.paper.length||!confirm('確定清空本次作答的全部計算筆跡？建議先下載圖片保存。'))return;owner.paper=[];redo.length=0;paint();status();save();};
  $('#paperZoomIn').onclick=()=>{zoom(1.25);save();};$('#paperZoomOut').onclick=()=>{zoom(.8);save();};$('#paperFit').onclick=fit;
  $('#paperDownload').onclick=()=>{
    finish();const b=bounds()||{x:0,y:0,X:900,Y:900},width=Math.max(1,b.X-b.x),height=Math.max(1,b.Y-b.y),scale=Math.min(2,2048/Math.max(width,height));
    const image=document.createElement('canvas');image.width=Math.max(1,Math.ceil(width*scale));image.height=Math.max(1,Math.ceil(height*scale));const c=image.getContext('2d');
    c.setTransform(scale,0,0,scale,-b.x*scale,-b.y*scale);draw(c);c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='destination-over';c.fillStyle='white';c.fillRect(0,0,image.width,image.height);
    const name=`計算紙_${current.session}_第${owner.ordinal}次.png`;
    image.toBlob(blob=>{
      if(!blob){notify('圖片產生失敗，請保留本頁後重試。');return;}
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=name;a.href=url;
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    },'image/png');
  };
  window.updatePaperState=()=>{if(run!==owner)return;if(!editable()&&stroke){finish();cancelPointers();}status();};
  window.repaintPaper=paint;
  window.paperCleanup=()=>{clearTimeout(saveTimer);observer.disconnect();};status();
}

// Theme preferences are independent of exam records and survive clearing practice history.
const THEME_KEY='site-supervisor-theme-v1',themeMedia=matchMedia('(prefers-color-scheme: dark)');
let themeMode=['light','night'].includes(document.documentElement.dataset.theme)?document.documentElement.dataset.theme:'system';
function applyTheme(){
  document.documentElement.dataset.theme=themeMode;
  $$('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===themeMode)));
  window.repaintPaper?.();
}
$$('[data-mode]').forEach(button=>button.onclick=()=>{
  themeMode=button.dataset.mode;applyTheme();
  try{localStorage.setItem(THEME_KEY,themeMode);}catch{notify('顯示模式已切換，但此瀏覽器無法儲存偏好；重新開啟後將跟隨系統。');}
});
themeMedia.addEventListener('change',()=>{if(themeMode==='system')applyTheme();});
window.addEventListener('storage',e=>{if(e.key===THEME_KEY){themeMode=['light','night'].includes(e.newValue)?e.newValue:'system';applyTheme();}});
applyTheme();
