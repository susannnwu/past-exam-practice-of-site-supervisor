const {chromium}=require('playwright'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.QUIZ_TEST_OUTPUT||path.join(root,'test-results');
(async()=>{
fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE}),reports=[];
 try{for(const entry of ['index.html','dist/index.html'])for(const width of [390,1280]){
  const ctx=await browser.newContext({offline:false,viewport:{width,height:844}}),p=await ctx.newPage(),errors=[];
  p.on('dialog',d=>d.accept());p.on('pageerror',e=>errors.push(e.message));await p.goto(new URL(entry,process.env.QUIZ_TEST_BASE_URL).href);
  const expected=await p.evaluate(()=>{
   startExam(DATA.find(e=>e.questions.some(q=>q.answer==='送分')).id);
   return current.questions.map((q,i)=>{
    const good=answerSet(q.answer),chosen=i%3===0?good[0]:i%3===1?['A','B','C','D'].find(k=>!good.includes(k)):null;
    if(chosen)document.querySelector(`input[name=q${i}][value=${chosen}]`).checked=true;
    return q.answer==='送分'?'bonus':chosen&&good.includes(chosen)?'correct':chosen?'incorrect':'unanswered';
   });
  });
  await p.locator('#submit').click();
  assert(await p.locator('.result').isVisible());assert(!(await p.locator('#cards').isVisible()));
  assert(!(await p.locator('header').isVisible()));assert.equal(await p.locator('.review-jump').count(),50);
  assert.equal(await p.locator('.review-item').count(),50);
  assert.equal(await p.locator('.result strong').textContent(),`得分 ${expected.filter(x=>x==='bonus'||x==='correct').length*2}／100 分`);
  for(let i=0;i<50;i++){
   const b=p.locator(`[data-review-index="${i}"]`);assert((await b.getAttribute('class')).includes(expected[i]));
   await b.click();assert.equal(await p.evaluate(()=>document.activeElement.id),`review-question-${i}`);
   const box=await p.locator(`#review-question-${i}`).boundingBox();const bar=await p.locator('.quiz-actions').boundingBox();assert(box.y>=0&&box.y<bar.y,'Target must be above the fixed toolbar');
   await p.locator('#backOverview').click();assert.equal(await p.evaluate(()=>document.activeElement.id),'reviewOverview');
  }
  assert(await p.locator('#backOverview').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await p.screenshot({path:path.join(out,`${entry==='index.html'?'來源':'發佈版'}_成績一覽_${width}.png`)});
  await p.locator('[data-mode=night]').click();await p.locator('#backOverview').click();
  await p.screenshot({path:path.join(out,`${entry==='index.html'?'來源':'發佈版'}_深色一覽_${width}.png`)});
  await p.locator('#backTop').click();assert(!(await p.locator('#quiz').isVisible()));
  await p.locator('#start').click();assert.equal(await p.locator('#backOverview').count(),0);
  assert(await p.locator('#cards').isVisible());assert(await p.locator('#submit').isVisible());
  assert.deepEqual(errors,[]);reports.push({entry,width,all50Statuses:true,scoreMatches:true,all50Links:true,fixedReturn:true,cleanReview:true,nextAttempt:true,servedOverHTTP:true});
  await ctx.close();
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'成績一覽驗證_V2.6.8.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exitCode=1;});
