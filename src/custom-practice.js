const CUSTOM_PRACTICES_KEY='site-supervisor-custom-practices-v1';
const examById=new Map(DATA.map(exam=>[exam.id,exam]));
const customDefinitions=()=>readStore(CUSTOM_PRACTICES_KEY,{});

function sourceExam(question,exam){
  return question.origin?examById.get(question.origin.examId):exam;
}

function findPractice(id){
  const original=examById.get(id);
  if(original)return original;
  if(!id.startsWith('custom-'))return null;
  const definition=customDefinitions()[id];
  if(!definition?.items.length)return null;
  const questions=definition.items.map((origin,index)=>{
    const question=examById.get(origin.examId)?.questions.find(q=>q.number===origin.number);
    return question&&{...question,origin,number:index+1};
  });
  return questions.every(Boolean)?{id,custom:true,session:definition.name||'自組練習',questions}:null;
}

function clearTemporaryPractices(){
  const definitions=Object.entries(customDefinitions());
  const named=definitions.filter(([,definition])=>definition.name);
  if(!named.length)localStorage.removeItem(CUSTOM_PRACTICES_KEY);
  else if(named.length!==definitions.length)writeStore(CUSTOM_PRACTICES_KEY,Object.fromEntries(named));
}

function examSourceLabel(exam){
  return `${exam.session}・${label(exam.sheet).replace(exam.session,'').trim()}`;
}

function pdfLink(exam,page){
  const path=exam.pdf.split('/').map(encodeURIComponent).join('/');
  return `<a class="source" href="${PDF_PREFIX}${path}#page=${page}" target="_blank" rel="noopener">查看原卷 PDF 第 ${page} 頁</a>`;
}

function questionSource(question){
  if(!question.origin)return '';
  const exam=sourceExam(question);
  return `<p class="question-source">${escapeHtml(examSourceLabel(exam))}・原卷第 ${question.origin.number} 題｜${pdfLink(exam,question.source.page)}</p>`;
}

function renderCustomHistory(){
  const drafts=readStore(DRAFTS_KEY,{});
  const definitions=Object.entries(customDefinitions()).reverse();
  const saved=[],temporary=[];
  for(const [id,definition] of definitions){
    const records=getRuns(id).slice().reverse();
    const draft=drafts[id];
    const resumable=draft&&!records.some(record=>record.id===draft.id);
    if(!definition.name&&!resumable&&!records.length)continue;
    const date=new Date(definition.createdAt).toLocaleString('zh-TW');
    const start=definition.name&&!resumable?`<button class="primary" data-custom-start="${escapeHtml(id)}">${records.length?'再做一次':'開始練習'}</button>`:'';
    const row=`<section class="custom-attempts"><div class="custom-attempt-heading"><h4>${escapeHtml(definition.name||'自組練習')}・${definition.items.length} 題</h4>${start}</div>
      <p class="hint">建立於 ${escapeHtml(date)}</p>
      ${resumable?`<div class="saved-row"><div><b>${runName(draft)}</b><div>已答 ${Object.values(draft.answers).filter(Boolean).length} 題・累計 ${formatTime(draft.elapsedMs)}</div></div>
        <button class="primary" data-custom-resume="${escapeHtml(id)}">繼續作答</button></div>`:''}
      ${records.map(record=>`<div class="saved-row"><div><b>${runName(record)}</b><div>得分 ${record.points}/${record.maxPoints} 分・用時 ${formatTime(record.elapsedMs)}</div></div>
        <button class="secondary" data-custom-id="${escapeHtml(id)}" data-custom-record="${escapeHtml(record.id)}">查看成績與檢討</button></div>`).join('')}</section>`;
    (definition.name?saved:temporary).push(row);
  }
  $('#customHistory').innerHTML=
    '<h3>已儲存題組</h3>'+(saved.join('')||'<p class="hint">從「查看題單」儲存有名稱的題組，可在這裡反覆練習。</p>')+
    '<h3>臨時組卷紀錄</h3>'+(temporary.join('')||'<p class="hint">開始臨時組卷練習後，可在這裡續答或檢討。</p>');
}

function addWrongReviewFilter(review,attempts){
  const wrong=attempts.map(a=>!a.isCorrect&&!a.isBonus&&!a.unknown);
  const filter=document.createElement('label');
  filter.className='wrong-review-filter';
  filter.innerHTML=`<input id="customWrongOnly" type="checkbox"> 只看錯題（含未作答，共 ${wrong.filter(Boolean).length} 題）`;
  const empty=document.createElement('p');
  empty.className='hint';
  empty.textContent='本次沒有錯題。';
  empty.hidden=true;
  review.querySelector('h3').after(filter,empty);
  const input=filter.querySelector('input');
  const items=[...review.querySelectorAll('.review-item')];
  const groups=review.querySelectorAll('.scenario-group');
  const update=()=>{
    items.forEach((item,index)=>{item.hidden=input.checked&&!wrong[index];});
    groups.forEach(group=>{group.hidden=!group.querySelector('.review-item:not([hidden])');});
    empty.hidden=!input.checked||wrong.some(Boolean);
  };
  input.onchange=update;
  return target=>{
    if(target.hidden){input.checked=false;update();}
  };
}

// Normalize each character the same way for matching and for mapping highlights to the original text.
const normalizedCharacter=character=>character.normalize('NFKC').toLowerCase().replace(/\s/g,'');
const searchText=value=>Array.from(value,normalizedCharacter).join('');

function highlightMatch(value,term,snippet=false){
  let folded='',offset=0;
  const starts=[],ends=[];
  for(const character of value){
    const normalized=normalizedCharacter(character);
    for(let i=0;i<normalized.length;i++){starts.push(offset);ends.push(offset+character.length);}
    folded+=normalized;
    offset+=character.length;
  }
  const match=folded.indexOf(term);
  if(match<0)return escapeHtml(value);
  const start=starts[match],end=ends[match+term.length-1];
  const from=snippet?Math.max(0,start-22):0,to=snippet?Math.min(value.length,end+35):value.length;
  return (from?'…':'')+escapeHtml(value.slice(from,start))+'<mark>'+escapeHtml(value.slice(start,end))+'</mark>'+
    escapeHtml(value.slice(end,to))+(to<value.length?'…':'');
}

const sessionNumber=exam=>Number(exam.session.match(/第(\d+)次/)?.[1]||0);
const orderedExams=[...DATA].sort((a,b)=>Number(b.year)-Number(a.year)||sessionNumber(a)-sessionNumber(b)||
  a.sheet.localeCompare(b.sheet,'zh-Hant',{numeric:true}));

function buildSearchIndex(){
  const index=[];
  for(const exam of orderedExams){
    const groups=new Map();
    for(const question of exam.questions){
      const scenario=exam.scenarios?.find(group=>group.id===question.scenarioId);
      const key=JSON.stringify([exam.id,scenario?'s':'q',scenario?.id??question.number]);
      if(!groups.has(key))groups.set(key,{key,exam,scenario,items:[],fields:[]});
      const group=groups.get(key);
      if(!group.items.length&&scenario)group.fields.push({label:'共用情境',value:scenario.text});
      group.items.push(question);
      const prefix=scenario?`原卷第 ${question.number} 題`:'';
      group.fields.push({label:prefix+'題幹',value:question.question});
      for(const [letter,value] of Object.entries(question.options)){
        group.fields.push({label:prefix+`選項 ${letter}`,value});
      }
    }
    for(const group of groups.values()){
      for(const field of group.fields)field.normalized=searchText(field.value);
      index.push(group);
    }
  }
  return index;
}

const selection=new Map(),searchPageSize=20;
let searchIndex,searchHits=[],searchPage=0,activeTerm='',savedSelectionId=null;

function resultTitle(group){
  return `${examSourceLabel(group.exam)}・原卷第 ${group.items.map(q=>q.number).join('、')} 題`;
}

function currentSearchPage(){
  const start=searchPage*searchPageSize;
  return searchHits.slice(start,start+searchPageSize);
}

function renderSearchResults(){
  const start=searchPage*searchPageSize,shown=currentSearchPage();
  const totalPages=Math.ceil(searchHits.length/searchPageSize);
  $('#searchSummary').textContent=!activeTerm?'請輸入要搜尋的關鍵字。':searchHits.length?
    `共 ${searchHits.length} 筆結果（情境題整組計一筆），顯示第 ${start+1}–${start+shown.length} 筆。`:
    '找不到符合的題目。可試試其他關鍵字或放寬篩選。';
  $('#searchResults').innerHTML=shown.map(({group,matches},i)=>{
    const {exam,scenario,items}=group;
    const source=scenario?.source||items[0].source;
    const context=scenario?`<p><b>共用情境</b></p><p>${highlightMatch(scenario.text,activeTerm)}</p>${sourceImage(scenario.source,'原卷共用情境與圖表')}`:'';
    const questions=items.map(q=>`<div class="search-question"><b>原卷第 ${q.number} 題</b><p>${highlightMatch(q.question,activeTerm)}</p>
      ${sourceImage(q.source,`原卷第 ${q.number} 題圖表`)}
      <ul>${Object.entries(q.options).map(([letter,value])=>`<li>${letter}. ${highlightMatch(value,activeTerm)}</li>`).join('')}</ul>
      ${pdfLink(exam,q.source.page)}</div>`).join('');
    return `<article class="card search-result">
      <h3>${escapeHtml(resultTitle(group))}</h3>
      ${scenario?'<p class="hint">情境題・整組 '+items.length+' 題</p>':''}
      <ul class="search-matches">${matches.map(field=>`<li><b>${escapeHtml(field.label)}命中</b>　${highlightMatch(field.value,activeTerm,true)}</li>`).join('')}</ul>
      <div class="search-actions"><button class="primary" data-add-result="${start+i}"></button>${pdfLink(exam,source.page)}</div>
      <details><summary>展開題目與選項</summary>${context}${questions}</details>
    </article>`;
  }).join('');
  $('#searchPages').hidden=totalPages<2;
  $('#searchPageNumber').textContent=`第 ${searchPage+1}／${totalPages} 頁`;
  $('#searchPrevious').disabled=searchPage===0;
  $('#searchNext').disabled=searchPage+1>=totalPages;
  renderSelection();
}

function renderSelection(){
  const groups=[...selection.values()];
  const count=groups.reduce((sum,group)=>sum+group.items.length,0);
  $('#selectionCount').textContent=`已選 ${count} 題`;
  $('#selectionTotal').textContent=`共 ${count} 題，滿分 ${count*2} 分`;
  for(const id of ['startCustom','clearSelection','groupName','saveGroup'])$('#'+id).disabled=!count;
  if($('#selectionDialog').open){
    $('#selectionItems').innerHTML=groups.map((group,index)=>`<div class="saved-row"><div><b>${escapeHtml(resultTitle(group))}</b>
      <div>${group.scenario?'情境題・整組':'單題・'} ${group.items.length} 題</div></div>
      <button class="secondary" data-remove-result="${index}" aria-label="移除 ${escapeHtml(resultTitle(group))}">移除</button></div>`).join('')||
      '<p class="hint">請先從搜尋結果加入題目。</p>';
  }
  $$('[data-add-result]').forEach(button=>{
    const {group}=searchHits[Number(button.dataset.addResult)];
    const added=selection.has(group.key);
    button.textContent=added?'已加入':group.scenario?`加入整組 ${group.items.length} 題`:'加入練習';
    button.setAttribute('aria-disabled',String(added));
  });
  $('#searchBulkActions').hidden=!searchHits.length;
  updateBulkButton($('#addSearchPage'),'加入本頁',currentSearchPage());
  updateBulkButton($('#addSearchAll'),'加入全部搜尋結果',searchHits);
}

function updateBulkButton(button,label,hits){
  const count=hits.reduce((sum,{group})=>sum+(selection.has(group.key)?0:group.items.length),0);
  button.textContent=`${label}（新增 ${count} 題）`;
  button.setAttribute('aria-disabled',String(!count));
}

function addSearchHits(hits){
  let added=0;
  for(const {group} of hits){
    if(selection.has(group.key))continue;
    selection.set(group.key,group);
    added+=group.items.length;
  }
  if(added)selectionChanged();
  return added;
}

function addBulkResults(hits){
  const added=addSearchHits(hits);
  if(added)notify(`已加入 ${added} 題，可在「查看題單」確認。`);
}

function searchQuestions(){
  activeTerm=searchText($('#searchTerm').value);
  const year=$('#searchYear').value,session=$('#searchSession').value;
  searchPage=0;
  searchHits=[];
  if(activeTerm){
    searchIndex??=buildSearchIndex();
    for(const group of searchIndex){
      if(year&&group.exam.year!==year||session&&group.exam.session!==session)continue;
      const matches=group.fields.filter(field=>field.normalized.includes(activeTerm));
      if(matches.length)searchHits.push({group,matches});
    }
  }
  renderSearchResults();
}

function selectionChanged(message=''){
  savedSelectionId=null;
  $('#selectionNotice').textContent=message;
  renderSelection();
}

function saveSelection(definitions,name=''){
  const items=[...selection.values()].flatMap(({exam,items})=>items.map(q=>({examId:exam.id,number:q.number})));
  const id='custom-'+(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`);
  const definition={items,createdAt:new Date().toISOString(),...(name?{name}:{})};
  return writeStore(CUSTOM_PRACTICES_KEY,{...definitions,[id]:definition})?id:null;
}

function saveNamedGroup(event){
  event.preventDefault();
  if(!selection.size)return;
  const field=$('#groupName'),status=$('#selectionNotice'),name=field.value.trim();
  const normalized=value=>value.normalize('NFKC').toLowerCase();
  const definitions=customDefinitions();
  if(!name||Object.values(definitions).some(group=>group.name&&normalized(group.name)===normalized(name))){
    status.textContent=name?'已有同名題組，請使用其他名稱。':'請輸入題組名稱。';
    field.focus();
    return;
  }
  const id=saveSelection(definitions,name);
  if(!id){status.textContent='目前無法儲存題組，題單仍保留。';return;}
  savedSelectionId=id;
  field.value='';
  status.textContent=`已儲存「${name}」。之後可從「已儲存題組」開啟。`;
  renderCustomHistory();
}

function startCustomPractice(){
  if(!selection.size)return;
  const id=savedSelectionId||saveSelection(customDefinitions());
  if(!id){$('#selectionNotice').textContent='目前無法儲存作答進度，題單仍保留。';return;}
  const retry=!!(savedSelectionId&&getRuns(id).length&&!readStore(DRAFTS_KEY,{})[id]);
  if(!startExam(id,retry)){
    if(!savedSelectionId){
      const definitions=customDefinitions();
      delete definitions[id];
      writeStore(CUSTOM_PRACTICES_KEY,definitions);
      $('#selectionNotice').textContent='目前無法開始練習，題單仍保留。';
    }
    return;
  }
  selection.clear();
  $('#selectionDialog').close();
  selectionChanged();
  $('#quiz h2').focus({preventScroll:true});
}

fill($('#searchYear'),[...new Set(orderedExams.map(exam=>exam.year))],'全部年份');
function updateSearchSessions(){
  const year=$('#searchYear').value;
  const sessions=[...new Set(orderedExams.filter(exam=>!year||exam.year===year).map(exam=>exam.session))];
  fill($('#searchSession'),sessions,'全部場次');
}
updateSearchSessions();
$('#searchYear').onchange=()=>{updateSearchSessions();searchQuestions();};
$('#searchSession').onchange=searchQuestions;
$('#searchForm').onsubmit=event=>{event.preventDefault();searchQuestions();$('#searchSummary').focus();};
$('#searchResults').onclick=event=>{
  const button=event.target.closest('[data-add-result]');
  if(!button)return;
  addSearchHits([searchHits[Number(button.dataset.addResult)]]);
};
$('#addSearchPage').onclick=()=>addBulkResults(currentSearchPage());
$('#addSearchAll').onclick=()=>addBulkResults(searchHits);
for(const [id,step] of [['searchPrevious',-1],['searchNext',1]]){
  $('#'+id).onclick=()=>{searchPage+=step;renderSearchResults();$('#searchSummary').focus();};
}
$('#viewSelection').onclick=()=>{$('#selectionDialog').showModal();renderSelection();};
$('#selectionDialog').addEventListener('close',()=>{if(!$('#selectionDialog').open)$('#selectionItems').replaceChildren();});
$('#closeSelection').onclick=()=>$('#selectionDialog').close();
$('#clearSelection').onclick=()=>{
  if(!selection.size||!confirm('確定要清空目前題單嗎？已儲存的題組與作答紀錄會保留。'))return;
  selection.clear();
  selectionChanged('已清空目前題單。');
  $('#closeSelection').focus();
};
$('#saveGroupForm').onsubmit=saveNamedGroup;
$('#viewCustomHistory').onclick=()=>$('#customHistory').focus();
$('#selectionItems').onclick=event=>{
  const button=event.target.closest('[data-remove-result]');
  if(!button)return;
  const index=Number(button.dataset.removeResult);
  selection.delete([...selection.keys()][index]);
  selectionChanged();
  const remaining=$$('[data-remove-result]');
  (remaining[Math.min(index,remaining.length-1)]||$('#closeSelection')).focus();
};
$('#startCustom').onclick=startCustomPractice;
$('#customHistory').onclick=event=>{
  const start=event.target.closest('[data-custom-start]');
  const resume=event.target.closest('[data-custom-resume]');
  const review=event.target.closest('[data-custom-record]');
  if(start){const id=start.dataset.customStart;startExam(id,!!getRuns(id).length);}
  if(resume)resumeExam(resume.dataset.customResume);
  if(review)openAttemptReview(review.dataset.customId,review.dataset.customRecord);
};
