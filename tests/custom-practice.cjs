const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const output=process.env.QUIZ_TEST_OUTPUT||path.resolve(__dirname,'../test-results');

async function verify(browser,entry,width){
  const context=await browser.newContext({viewport:{width,height:844},colorScheme:width===390?'dark':'light'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(new URL(entry,process.env.QUIZ_TEST_BASE_URL).href);
  const legacy=await page.evaluate(()=>{
    const exam=DATA.find(e=>e.year==='111'&&e.session==='111年第1次'&&e.sheet.endsWith('第1類科A卷'));
    const answers={1:{selected:'B',correct:'B',isCorrect:true,isBonus:false}};
    localStorage.setItem(ATTEMPTS_KEY,JSON.stringify({[exam.id]:answers}));
    localStorage.setItem(COMPLETED_KEY,JSON.stringify([exam.id]));
    localStorage.setItem(MARKS_KEY,JSON.stringify({[exam.id+'-1']:{checks:true}}));
    return {id:exam.id,answers:localStorage.getItem(ATTEMPTS_KEY),completed:localStorage.getItem(COMPLETED_KEY)};
  });
  await page.locator('[data-view=builder]').click();
  const search=async term=>{
    await page.locator('#searchTerm').fill(term);
    await page.locator('#searchTerm').press('Enter');
  };
  const cards=page.locator('.search-result');
  await search('   ');
  assert.match(await page.locator('#searchSummary').textContent(),/請輸入/);
  await search('<無此題>');
  assert.match(await page.locator('#searchSummary').textContent(),/找不到/);
  await page.locator('#viewSelection').click();
  assert(await page.locator('#startCustom').isDisabled());
  await page.keyboard.press('Escape');
  await search('ＣＣＤ');
  assert.equal(await cards.count(),2);
  const first=cards.filter({hasText:'111年第1次・第1類科A卷・原卷第 1 題'});
  assert.match(await first.textContent(),/選項 D命中/);
  assert.equal(await first.locator('.search-matches mark').textContent(),'CCD');
  assert.match(await first.getByRole('link').first().getAttribute('href'),/#page=2$/);
  assert.equal(await first.locator('.answer-correct').count(),0);
  await first.getByRole('button',{name:'加入練習'}).click();

  await search('潛盾');
  await page.selectOption('#searchYear','115');
  await page.selectOption('#searchSession','115年第1次');
  const scenario=cards.filter({hasText:'115年第1次・第1類科A卷・原卷第 32、33 題'});
  assert.match(await scenario.locator('.search-matches').textContent(),/共用情境命中/);
  assert.doesNotMatch(await scenario.locator('.search-matches').textContent(),/第 (32|33) 題/);
  await scenario.getByRole('button',{name:'加入整組 2 題'}).click();
  await search('真北儀');
  assert.match(await scenario.locator('.search-matches').textContent(),/原卷第 32 題題幹命中/);
  assert.equal(await scenario.locator('[data-add-result]').getAttribute('aria-disabled'),'true');
  await scenario.locator('[data-add-result]').evaluate(button=>button.click());
  assert.equal(await page.locator('#selectionCount').textContent(),'已選 3 題');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  await page.screenshot({path:path.join(output,`搜尋結果_${entry.includes('dist')?'發佈版':'來源'}_${width}.png`)});
  await page.locator('#viewSelection').click();
  await page.locator('#selectionItems button').last().click();
  assert.match(await page.locator('#selectionTotal').textContent(),/共 1 題/);
  await page.locator('#closeSelection').click();
  await scenario.getByRole('button',{name:'加入整組 2 題'}).click();

  await page.selectOption('#searchYear','');
  assert.equal(await page.locator('#searchSession').inputValue(),'');
  await search('混凝土');
  assert.equal(await cards.count(),20);
  await page.locator('#searchNext').click();
  assert.match(await page.locator('#searchSummary').textContent(),/第 21–40 筆/);
  await page.locator('#searchPrevious').click();
  const other=await page.evaluate(()=>{
    const exam=orderedExams.find(e=>e.year==='115'&&!e.questions[0].scenarioId);
    return {term:exam.questions[0].question,title:examSourceLabel(exam)+'・原卷第 1 題'};
  });
  await page.selectOption('#searchYear','115');
  await search(other.term);
  await cards.filter({has:page.getByRole('heading',{name:other.title,exact:true})}).getByRole('button',{name:'加入練習'}).click();
  await page.locator('#viewSelection').click();
  assert.match(await page.locator('#selectionTotal').textContent(),/共 4 題，滿分 8 分/);
  await page.locator('#startCustom').click();
  assert(await page.locator('#quiz').isVisible());
  assert.equal(await page.locator('#cards .question').count(),4);
  assert.equal(await page.locator('#cards .scenario-group .question').count(),2);
  const answer=await page.evaluate(()=>answerSet(current.questions[0].answer)[0]);
  assert.equal(await page.locator('#cards .question-source').filter({hasText:'原卷第 1 題'}).count(),2);
  const check=page.locator('#cards [data-mark=checks]').first();
  assert.equal(await check.getAttribute('aria-pressed'),'true');
  await page.locator('#cards [data-mark=flags]').first().click();
  await page.locator(`input[name=q0][value=${answer}]`).check();
  await page.locator('input[name=q3][value=A]').check();
  await page.locator('#backTop').click();
  assert(await page.locator('#customHistory [data-custom-resume]').isVisible());
  await page.reload();
  await page.locator('[data-view=builder]').click();
  await page.locator('#customHistory [data-custom-resume]').click();
  assert(await page.locator(`input[name=q0][value=${answer}]`).isChecked());
  assert(await page.locator('input[name=q3][value=A]').isChecked());
  await page.locator('#submit').click();
  assert.match(await page.locator('.result strong').textContent(),/／8 分/);
  assert.equal(await page.locator('.review-jump').count(),4);
  assert.equal(await page.locator('.review-jump').first().locator('[data-snapshot-mark=flag]').count(),1);
  await page.locator('#customWrongOnly').check();
  assert(!(await page.locator('#review-question-0').isVisible()));
  assert(await page.locator('#review-question-1').isVisible());
  await page.locator('[data-review-index="0"]').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'review-question-0');
  await page.locator('#backTop').click();
  await page.locator('[data-view=marked]').click();
  await page.locator('#markedList [data-mark=flags]').first().click();
  await page.locator('[data-view=builder]').click();
  await page.locator('[data-custom-record]').click();
  assert.equal(await page.locator('.review-jump').first().locator('[data-snapshot-mark=flag]').count(),1);
  await page.locator('#retryExam').click();
  assert.equal(await page.locator('#cards input:checked').count(),0);
  assert.equal(await page.locator('#cards .question').count(),4);
  assert.match(await page.locator('#runLabel').textContent(),/第 2 次/);
  assert.deepEqual(await page.evaluate(id=>({
    id,answers:localStorage.getItem(ATTEMPTS_KEY),completed:localStorage.getItem(COMPLETED_KEY)
  }),legacy.id),legacy);
  assert.deepEqual(errors,[]);
  await context.close();
}

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
  try{
    for(const entry of ['index.html','dist/index.html']){
      for(const width of [390,1280])await verify(browser,entry,width);
    }
    console.log('PASS: custom practice across source and Pages builds at 390px and 1280px');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
