const {chromium}=require('playwright'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.QUIZ_TEST_OUTPUT||path.join(root,'test-results');
(async()=>{
fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE}),reports=[];
 try{for(const entry of ['index.html','dist/index.html']){
  const c=await b.newContext({offline:false,viewport:{width:390,height:844}}),p=await c.newPage();
  let accept=false;const prompts=[];p.on('dialog',async d=>{prompts.push(d.message());await (accept?d.accept():d.dismiss());});
  await p.goto(new URL(entry,process.env.QUIZ_TEST_BASE_URL).href);await p.evaluate(()=>startExam(DATA[0].id));
  await p.locator('#submit').click();assert(prompts.at(-1).includes('50 題未作答'));
  assert(await p.evaluate(()=>!run.submitted&&!!run.runningSince&&getRuns(current.id).length===0));
  await p.locator('input[name=q0][value=A]').check();await p.locator('#submit').click();
  assert(prompts.at(-1).includes('49 題未作答'));assert(await p.locator('input[name=q0][value=A]').isChecked());
  assert.equal(await p.locator('#reviewOverview').count(),0);
  accept=true;await p.locator('#submit').click();assert(await p.locator('#reviewOverview').isVisible());
  assert.equal(await p.evaluate(()=>getRuns(current.id).length),1);
  await p.locator('#backTop').click();await p.locator('#start').click();
  await p.evaluate(()=>document.querySelectorAll('#cards input[value=A]').forEach(x=>x.checked=true));
  accept=false;const count=prompts.length;await p.locator('#submit').click();assert.equal(prompts.length,count+1);assert.equal(prompts.at(-1),'確定要交卷嗎？');assert(await p.evaluate(()=>!run.submitted&&getRuns(current.id).length===1));accept=true;await p.locator('#submit').click();
  assert.equal(await p.evaluate(()=>getRuns(current.id).length),2);
  reports.push({entry,empty50Confirmed:true,partial49Confirmed:true,cancelKeepsAnswersAndTimer:true,confirmSubmitsOnce:true,completeAlsoConfirms:true});await c.close();
 }}finally{await b.close();}
 fs.writeFileSync(path.join(out,'未作答交卷確認_V2.6.8.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exitCode=1;});
