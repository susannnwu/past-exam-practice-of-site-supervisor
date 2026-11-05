const {chromium}=require('playwright'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.QUIZ_TEST_OUTPUT||path.join(root,'test-results');
(async()=>{
fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE}),reports=[];
 try{for(const entry of ['index.html','dist/index.html']){
  const c=await b.newContext({offline:false,viewport:{width:390,height:844}}),p=await c.newPage();let accept=true;
  const prompts=[];p.on('dialog',d=>{prompts.push(d.message());return accept?d.accept():d.dismiss();});await p.goto(new URL(entry,process.env.QUIZ_TEST_BASE_URL).href);
  await p.evaluate(()=>{startExam(DATA[0].id);run.elapsedMs=123000;});await p.locator('input[name=q0][value=A]').check();await p.locator('#submit').click();
  const old=await p.evaluate(()=>({id:current.id,records:JSON.stringify(storedRuns(current.id))}));
  const unchanged=await p.evaluate(()=>JSON.stringify({...localStorage}));accept=false;await p.locator('#retryExam').click();assert(prompts.at(-1).includes('確定要再做一次嗎'));assert(await p.locator('#reviewOverview').isVisible());assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),unchanged);
  accept=true;const beforePrompts=prompts.length;await p.locator('#retryExam').click();assert.equal(prompts.length,beforePrompts+1);
  assert(await p.evaluate(id=>current.id===id&&run.ordinal===2&&!run.submitted&&elapsed()<5000&&Object.values(run.answers).every(a=>!a),old.id));
  assert.equal(await p.evaluate(()=>JSON.stringify(storedRuns(current.id))),old.records);
  await p.locator('input[name=q0][value=B]').check();await p.locator('#backTop').click();
  await p.locator('[data-history]').click();
  const before=await p.evaluate(()=>localStorage.getItem(DRAFTS_KEY));accept=false;await p.locator('#retryExam').click();
  assert(await p.locator('#reviewOverview').isVisible());assert.equal(await p.evaluate(()=>localStorage.getItem(DRAFTS_KEY)),before);
  accept=true;await p.locator('#retryExam').click();assert(await p.evaluate(()=>!run.submitted&&run.ordinal===2&&Object.values(run.answers).every(a=>!a)));
  assert.equal(await p.evaluate(()=>JSON.stringify(storedRuns(current.id))),old.records);
  await p.locator('#submit').click();assert.equal(await p.evaluate(()=>getRuns(current.id).length),2);
  reports.push({entry,alwaysConfirms:true,cancelWithoutDraftChangesNothing:true,sameExam:true,resetAnswersAndTime:true,preserveHistory:true,draftReplacementConfirmed:true,nextSubmissionNumber:true});await c.close();
 }}finally{await b.close();}
 fs.writeFileSync(path.join(out,'再做一次驗證_V2.6.8.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exitCode=1;});
