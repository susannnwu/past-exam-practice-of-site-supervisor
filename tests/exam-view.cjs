const {chromium}=require('playwright'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.QUIZ_TEST_OUTPUT||path.join(root,'test-results');
(async()=>{
fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE}),report=[];
 try{for(const entry of ['index.html','dist/index.html'])for(const width of [390,1280]){
  const context=await browser.newContext({offline:false,viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL(entry,process.env.QUIZ_TEST_BASE_URL).href);
  assert.equal(await page.title(),'工地主任歷屆試題模擬練習');assert.equal(await page.locator('h1').textContent(),'工地主任歷屆試題模擬練習');
  await page.locator('#start').click();
  assert(await page.locator('.controls').isVisible(),'Empty selection stays on selection screen');
  const id=await page.locator('#sheet option').nth(1).getAttribute('value');
  await page.selectOption('#sheet',id);await page.locator('#start').click();
  for(const selector of ['header','.tabs','.controls','#savedProgress','#examHistory','#home > .hint'])assert(!(await page.locator(selector).first().isVisible()),selector);
  assert(await page.locator('#quiz').isVisible());assert(await page.locator('#submit').isVisible());
  assert.equal(await page.evaluate(()=>scrollY),0);
  await page.locator('input[name=q0][value=A]').check();
  await page.locator('#backTop').click();
  assert(!(await page.locator('#quiz').isVisible()));assert(await page.locator('header').isVisible());
  assert.equal(await page.evaluate(()=>run.runningSince),null);
  await page.reload();
  await page.locator('#savedProgress [data-resume]').click();
  assert(!(await page.locator('.controls').isVisible()));assert(await page.locator('input[name=q0][value=A]').isChecked());
  await page.screenshot({path:path.join(out,`${entry==='index.html'?'來源':'發佈版'}_專用作答畫面_${width}.png`)});
  await page.locator('#submit').click();
  assert(await page.locator('.result').isVisible());assert(!(await page.locator('#cards').isVisible()));assert.equal(await page.locator('.review-item').count(),50);assert(!(await page.locator('#savePause').isVisible()));assert(!(await page.locator('#submit').isVisible()));assert(await page.locator('#backTop').isVisible());await page.screenshot({path:path.join(out,`${entry==='index.html'?'來源':'發佈版'}_成績檢討_${width}.png`)});assert(!(await page.locator('header').isVisible()));
  await page.locator('#backTop').click();
  assert(await page.locator('.controls').isVisible());assert(await page.locator('#examHistory').isVisible());
  await page.locator('[data-view=wrong]').click();assert(await page.locator('#wrong').isVisible());await page.locator('[data-view=home]').click();await page.locator('#start').click();assert(await page.locator('#cards').isVisible());assert(await page.locator('#submit').isVisible());assert.equal(await page.locator('.review').count(),0);
  assert.deepEqual(errors,[]);report.push({entry,width,emptySelection:true,cleanExamView:true,saveReturnResume:true,answersPreserved:true,submittedReview:true,historyAndWrongView:true,servedOverHTTP:true});
  await context.close();
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'作答畫面驗證_V2.6.8.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
