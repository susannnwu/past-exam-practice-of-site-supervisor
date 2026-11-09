const CUSTOM_PRACTICES_KEY='site-supervisor-custom-practices-v1';
const examById=new Map(DATA.map(exam=>[exam.id,exam]));
const customDefinitions=()=>readStore(CUSTOM_PRACTICES_KEY,{});
const collectionId=(id,definition)=>definition.collectionId||id;
const newPracticeId=()=>'custom-'+(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`);

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
  const previous=new Map();
  const saved=[],temporary=[];
  function attempts(id){
    const records=getRuns(id).slice().reverse();
    const draft=drafts[id];
    const resumable=draft&&!records.some(record=>record.id===draft.id);
    const html=`
      ${resumable?`<div class="saved-row"><div><b>${runName(draft)}</b><div>已答 ${Object.values(draft.answers).filter(Boolean).length} 題・累計 ${formatTime(draft.elapsedMs)}</div></div>
        <button class="primary" data-custom-resume="${escapeHtml(id)}">繼續作答</button></div>`:''}
      ${records.map(record=>`<div class="saved-row"><div><b>${runName(record)}</b><div>得分 ${record.points}/${record.maxPoints} 分・用時 ${formatTime(record.elapsedMs)}</div></div>
        <button class="secondary" data-custom-id="${escapeHtml(id)}" data-custom-record="${escapeHtml(record.id)}">查看成績與檢討</button></div>`).join('')}`;
    return {records,resumable,html};
  }
  for(const [id,definition] of definitions.filter(([,definition])=>definition.archived)){
    const {records,resumable,html}=attempts(id);
    if(!records.length&&!resumable)continue;
    const key=collectionId(id,definition);
    if(!previous.has(key))previous.set(key,[]);
    previous.get(key).push(`<div class="previous-practice"><h5>分類前的題組・${definition.items.length} 題</h5>${html}</div>`);
  }
  for(const [id,definition] of definitions.filter(([,definition])=>!definition.archived)){
    const {records,resumable,html}=attempts(id);
    if(!definition.name&&!resumable&&!records.length)continue;
    const date=new Date(definition.createdAt).toLocaleString('zh-TW');
    const canPractice=definition.name&&definition.items.length;
    const start=canPractice&&!resumable?`<button class="primary" data-custom-start="${escapeHtml(id)}">${records.length?'再做一次':'開始練習'}</button>`:'';
    const classify=canPractice?`<button class="secondary" data-classify-group="${escapeHtml(id)}">挑題分類</button>`:'';
    const history=previous.get(collectionId(id,definition))?.join('')||'';
    const row=`<section class="custom-attempts"><div class="custom-attempt-heading"><h4>${escapeHtml(definition.name||'自組練習')}・${definition.items.length} 題</h4><div class="selection-tools">${classify}${start}</div></div>
      <p class="hint">建立於 ${escapeHtml(date)}</p>${html}${history}</section>`;
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
const checkedGroups=new Set();
let searchIndex,searchHits=[],searchPage=0,activeTerm='',classificationSource=null;

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
  if($('#selectionDialog').open)renderClassification();
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
  $('#selectionNotice').textContent=message;
  renderSelection();
}

const classificationGroups=()=>classificationSource?.groups||selection;
const questionRefs=groups=>[...groups].flatMap(({exam,items})=>items.map(q=>({examId:exam.id,number:q.number})));
const originKey=origin=>JSON.stringify([origin.examId,origin.number]);

function updateClassificationControls(){
  const groups=classificationGroups();
  const count=[...groups].reduce((sum,[key,group])=>sum+(checkedGroups.has(key)?group.items.length:0),0);
  const newGroup=!$('#groupDestination').value;
  $('#classificationCount').textContent=`勾選 ${count} 題供分類`;
  $('#checkAllGroups').disabled=checkedGroups.size===groups.size;
  $('#uncheckAllGroups').disabled=!count;
  $('#groupDestination').disabled=!count;
  $('#groupNameField').hidden=!newGroup;
  $('#groupName').disabled=!count||!newGroup;
  $('#saveGroup').disabled=!count;
}

function renderClassification(){
  const groups=classificationGroups();
  const source=classificationSource;
  $('#selectionTitle').textContent=source?`分類「${source.name}」`:'本次題單';
  $('#clearSelection').hidden=!!source;
  $('#clearSelection').disabled=!groups.size;
  $('#startCustom').hidden=!!source;
  $('#startCustom').disabled=!selection.size;
  if(source)$('#selectionTotal').textContent=`來源題組剩餘 ${questionRefs(groups.values()).length} 題`;
  $('#saveGroup').textContent=source?'移動勾選題目':'儲存勾選題目';
  $('#selectionItems').innerHTML=[...groups].map(([key,group],index)=>`<div class="saved-row">
    <label class="classification-item"><input type="checkbox" data-classify-item="${index}" ${checkedGroups.has(key)?'checked':''}>
      <span><b>${escapeHtml(resultTitle(group))}</b><small>${group.scenario?'情境題・整組':'單題・'} ${group.items.length} 題</small></span></label>
    ${source?'':`<button class="secondary" data-remove-result="${index}" aria-label="移除 ${escapeHtml(resultTitle(group))}">移除</button>`}</div>`).join('')||
    (source?'<p class="hint">來源題組已無待分類的題目。</p>':'<p class="hint">請先從搜尋結果加入題目。</p>');
  updateClassificationControls();
}

function refreshGroupDestinations(){
  const destinations=Object.entries(customDefinitions()).filter(([id,group])=>group.name&&!group.archived&&id!==classificationSource?.id);
  const names=new Map(destinations.map(([id,group])=>[id,group.name]));
  fill($('#groupDestination'),[...names.keys()],'新增命名題組',id=>names.get(id));
}

function openClassification(source=null){
  classificationSource=source;
  checkedGroups.clear();
  if(!source)for(const key of selection.keys())checkedGroups.add(key);
  $('#groupName').value='';
  $('#selectionNotice').textContent='';
  refreshGroupDestinations();
  $('#selectionDialog').showModal();
  renderSelection();
}

function openSavedClassification(id){
  const definition=customDefinitions()[id],exam=findPractice(id);
  if(!exam||!definition?.name||definition.archived){notify('題組已更新，請重新開啟再分類。');return;}
  const groups=new Map();
  for(const question of exam.questions){
    const original=sourceExam(question);
    const scenario=original.scenarios?.find(group=>group.id===question.scenarioId);
    const key=JSON.stringify([original.id,scenario?'s':'q',scenario?.id??question.origin.number]);
    if(!groups.has(key))groups.set(key,{exam:original,scenario,items:[]});
    groups.get(key).items.push({...question,number:question.origin.number});
  }
  openClassification({id,name:definition.name,groups});
}

function reviseGroup(definitions,id,items){
  const previous=definitions[id],key=collectionId(id,previous);
  definitions[id]={...previous,collectionId:key,archived:true};
  const nextId=newPracticeId();
  definitions[nextId]={...previous,collectionId:key,items};
  return nextId;
}

function saveNamedGroup(event){
  event.preventDefault();
  if(!checkedGroups.size)return;
  const field=$('#groupName'),status=$('#selectionNotice'),destination=$('#groupDestination').value;
  const normalized=value=>value.normalize('NFKC').toLowerCase();
  const definitions=customDefinitions();
  const target=definitions[destination],sourceId=classificationSource?.id;
  const source=definitions[sourceId];
  if((destination&&(!target?.name||target.archived))||(sourceId&&(!source||source.archived))){
    status.textContent='題組已更新，請重新開啟再分類。';
    return;
  }
  const name=target?.name||field.value.trim();
  if(!destination&&(!name||Object.values(definitions).some(group=>group.name&&!group.archived&&normalized(group.name)===normalized(name)))){
    status.textContent=name?'已有同名題組，請使用其他名稱。':'請輸入題組名稱。';
    field.focus();
    return;
  }
  const groups=classificationGroups();
  const chosen=[...groups].filter(([key])=>checkedGroups.has(key));
  const items=questionRefs(chosen.map(([,group])=>group));
  if(!items.length)return;
  if(target){
    const existing=new Set(target.items.map(originKey));
    const additions=items.filter(item=>!existing.has(originKey(item)));
    if(additions.length)reviseGroup(definitions,destination,[...target.items,...additions]);
  }else{
    definitions[newPracticeId()]={name,items,createdAt:new Date().toISOString()};
  }
  let nextSourceId;
  if(source){
    const moved=new Set(items.map(originKey));
    nextSourceId=reviseGroup(definitions,sourceId,source.items.filter(item=>!moved.has(originKey(item))));
  }
  if(!writeStore(CUSTOM_PRACTICES_KEY,definitions)){status.textContent='目前無法儲存題組，原本的題目仍保留。';return;}
  for(const [key] of chosen)groups.delete(key);
  if(source)classificationSource.id=nextSourceId;
  checkedGroups.clear();
  field.value='';
  refreshGroupDestinations();
  selectionChanged(`${source?'已移動':'已儲存'} ${items.length} 題至「${name}」。`);
  renderCustomHistory();
}

function startCustomPractice(){
  if(!selection.size)return;
  const id=newPracticeId();
  const definition={items:questionRefs(selection.values()),createdAt:new Date().toISOString()};
  if(!writeStore(CUSTOM_PRACTICES_KEY,{...customDefinitions(),[id]:definition})){
    $('#selectionNotice').textContent='目前無法儲存作答進度，題單仍保留。';return;
  }
  if(!startExam(id)){
    const definitions=customDefinitions();
    delete definitions[id];
    writeStore(CUSTOM_PRACTICES_KEY,definitions);
    $('#selectionNotice').textContent='目前無法開始練習，題單仍保留。';
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
$('#viewSelection').onclick=()=>openClassification();
$('#selectionDialog').addEventListener('close',()=>{
  if($('#selectionDialog').open)return;
  classificationSource=null;
  checkedGroups.clear();
  $('#selectionItems').replaceChildren();
});
$('#closeSelection').onclick=()=>$('#selectionDialog').close();
$('#clearSelection').onclick=()=>{
  if(!selection.size||!confirm('確定要清空目前題單嗎？已儲存的題組與作答紀錄會保留。'))return;
  selection.clear();
  checkedGroups.clear();
  selectionChanged('已清空目前題單。');
  $('#closeSelection').focus();
};
$('#saveGroupForm').onsubmit=saveNamedGroup;
$('#groupDestination').onchange=updateClassificationControls;
for(const [id,checked] of [['checkAllGroups',true],['uncheckAllGroups',false]]){
  $('#'+id).onclick=()=>{
    checkedGroups.clear();
    if(checked)for(const key of classificationGroups().keys())checkedGroups.add(key);
    $$('[data-classify-item]').forEach(input=>{input.checked=checked;});
    updateClassificationControls();
  };
}
$('#viewCustomHistory').onclick=()=>$('#customHistory').focus();
$('#selectionItems').onchange=event=>{
  const input=event.target.closest('[data-classify-item]');
  if(!input)return;
  const key=[...classificationGroups().keys()][Number(input.dataset.classifyItem)];
  if(input.checked)checkedGroups.add(key);else checkedGroups.delete(key);
  updateClassificationControls();
};
$('#selectionItems').onclick=event=>{
  const button=event.target.closest('[data-remove-result]');
  if(!button)return;
  const index=Number(button.dataset.removeResult);
  const key=[...selection.keys()][index];
  selection.delete(key);
  checkedGroups.delete(key);
  selectionChanged();
  const remaining=$$('[data-remove-result]');
  (remaining[Math.min(index,remaining.length-1)]||$('#closeSelection')).focus();
};
$('#startCustom').onclick=startCustomPractice;
$('#customHistory').onclick=event=>{
  const classify=event.target.closest('[data-classify-group]');
  const start=event.target.closest('[data-custom-start]');
  const resume=event.target.closest('[data-custom-resume]');
  const review=event.target.closest('[data-custom-record]');
  if(start){const id=start.dataset.customStart;startExam(id,!!getRuns(id).length);}
  if(classify)openSavedClassification(classify.dataset.classifyGroup);
  if(resume)resumeExam(resume.dataset.customResume);
  if(review)openAttemptReview(review.dataset.customId,review.dataset.customRecord);
};
