const {chromium}=require('playwright'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.QUIZ_TEST_OUTPUT||path.join(root,'test-results');
(async()=>{
fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE}),reports=[];
 try{for(const entry of ['index.html','dist/index.html'])for(const width of [390,1280]){
  const c=await b.newContext({offline:false,viewport:{width,height:844}}),p=await c.newPage(),errors=[];
  p.on('dialog',d=>d.accept());p.on('pageerror',e=>errors.push(e.message));await p.goto(new URL(entry,process.env.QUIZ_TEST_BASE_URL).href);
  const fixture=await p.evaluate(()=>{
   const exam=DATA.find(e=>e.scenarios?.length&&answerSet(e.questions[0].answer).length===1);
   const good=answerSet(exam.questions[0].answer)[0],bad=['A','B','C','D'].find(k=>k!==good);
   for(const chosen of [good,bad]){
    startExam(exam.id);document.querySelector('#cards [data-q="1"][data-mark="flags"]').click();if(chosen===bad)document.querySelector('#cards [data-q="1"][data-mark="checks"]').click();document.querySelector(`input[name=q0][value=${chosen}]`).checked=true;submitQuiz();document.querySelector('#backTop').click();
   }
   return {id:exam.id,good,bad,records:getRuns(exam.id).map(r=>r.id),snapshot:JSON.stringify({...localStorage})};
  });
  for(let n=0;n<2;n++){
   await p.locator(`[data-history="${fixture.records[n]}"]`).click();
   assert((await p.locator('.result').textContent()).includes(`第 ${n+1} 次作答`));
   assert.equal(await p.locator('.review-item .option').count(),200);
   assert.equal(await p.locator('.review-jump').count(),50);
   const tile=p.locator('[data-review-index="0"]');
   assert.equal(await tile.locator('[data-snapshot-mark=flag]').count(),n?0:1);
   assert.equal(await tile.locator('[data-snapshot-mark=check]').count(),n?1:0);
   if(!n)assert((await tile.textContent()).includes('○'));
   assert(!(await p.locator('.review').textContent()).match(/我的作答：|正確答案：|答對|答錯/));
   const aligned=await p.locator('#review-question-0').evaluate(q=>{const no=q.querySelector('.q-no').getBoundingClientRect(),t=q.querySelector('.q-text'),rect=t.getBoundingClientRect(),style=getComputedStyle(t);return Math.abs(no.y+no.height/2-(rect.y+parseFloat(style.paddingTop)+parseFloat(style.lineHeight)/2))<1;});assert(aligned);
   assert.equal(await p.locator('.review-jump.unanswered').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(242, 242, 247)');
   const q=p.locator('#review-question-0'),chosen=n?fixture.bad:fixture.good;
   assert.equal(await q.locator('input:checked').count(),1);
   assert((await q.locator('.option').filter({has:p.locator('input:checked')}).textContent()).includes(chosen+'.'));
   assert((await q.locator('.answer-correct').textContent()).includes(fixture.good+'.'));
   assert.equal(await q.locator('.answer-wrong').count(),n?1:0);
   assert(await p.locator('.review .scenario-group').count()>0);
   await p.locator('[data-review-index="49"]').click();
   assert.equal(await p.evaluate(()=>document.activeElement.id),'review-question-49');
   await p.locator('#backOverview').click();assert.equal(await p.locator('#backOverview').textContent(),'↑ 答題結果一覽');
   for(const mode of ['light','night']){
    await p.locator(`[data-mode=${mode}]`).click();await p.locator('#backOverview').click();
    const colors=await p.locator('.review-jump:not(.unanswered)').evaluateAll(es=>es.map(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor})));
    assert(colors.every(x=>x.fg==='rgb(255, 255, 255)'&&x.bg!=='rgba(0, 0, 0, 0)'));
   }
   await p.screenshot({path:path.join(out,`${entry==='index.html'?'來源':'發佈版'}_歷次檢討_${width}_${n+1}.png`)});
   await p.locator('#backTop').click();
  }
  // Theme preference is the only intentional storage change during review.
  const unchanged=await p.evaluate(before=>{const a=JSON.parse(before),z={...localStorage};delete a['site-supervisor-theme-v1'];delete z['site-supervisor-theme-v1'];return JSON.stringify(a)===JSON.stringify(z);},fixture.snapshot);
  assert(unchanged,'Review must not rewrite any attempt, draft, marks or paper');
  await p.locator('[data-view=wrong]').click();await p.selectOption('#wrongExam',fixture.id);await p.selectOption('#wrongRun',fixture.records[1]);
  const wrong=p.locator('#wrongList [data-question-number="1"]');
  assert.equal(await wrong.locator('.option').count(),4);assert.equal(await wrong.locator('.answer-wrong').count(),1);assert.equal(await wrong.locator('.answer-correct').count(),1);
  assert.deepEqual(errors,[]);reports.push({entry,width,twoDistinctAttempts:true,all200Options:true,correctGreenWrongRed:true,scenarioGroups:true,historyImmutable:true,solidWhiteLabels:true,wrongViewConsistent:true});
  await c.close();
 }}finally{await b.close();}
 fs.writeFileSync(path.join(out,'歷次檢討驗證_V2.6.8.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exitCode=1;});
