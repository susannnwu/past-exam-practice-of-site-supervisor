const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const output=process.env.QUIZ_TEST_OUTPUT||path.resolve(__dirname,'../test-results');

async function verifyBulk(page,search){
  const pageButton=page.locator('#addSearchPage'),allButton=page.locator('#addSearchAll');
  const selected=()=>page.evaluate(()=>[...selection.values()].flatMap(({exam,items})=>
    items.map(q=>JSON.stringify([exam.id,q.number]))).sort());
  const expected=()=>page.evaluate(()=>{
    const term='混凝土',year=document.querySelector('#searchYear').value,session=document.querySelector('#searchSession').value;
    const matches=text=>text.replace(/\s/g,'').includes(term);
    const direct=q=>[q.question,...Object.values(q.options)].some(matches);
    return DATA.filter(exam=>(!year||exam.year===year)&&(!session||exam.session===session)).flatMap(exam=>
      exam.questions.filter(q=>{
        const group=exam.scenarios.find(s=>s.id===q.scenarioId);
        return group?matches(group.text)||exam.questions.some(sibling=>sibling.scenarioId===group.id&&direct(sibling)):direct(q);
      }).map(q=>JSON.stringify([exam.id,q.number]))
    ).sort();
  });
  const expectCount=async (button,count)=>assert((await button.textContent()).includes(`新增 ${count} 題`));

  await search('混凝土');
  const all=await expected();
  const firstPage=await page.evaluate(()=>searchHits.slice(0,20).reduce((n,hit)=>n+hit.group.items.length,0));
  assert(all.length>firstPage);
  await expectCount(pageButton,firstPage);
  await expectCount(allButton,all.length);
  await page.locator('[data-add-result]').first().click();
  const initial=(await selected()).length;
  await expectCount(pageButton,firstPage-initial);
  await pageButton.click();
  assert.equal((await selected()).length,firstPage);
  assert.equal(await pageButton.getAttribute('aria-disabled'),'true');
  await pageButton.evaluate(button=>button.click());
  assert.equal((await selected()).length,firstPage);

  await page.locator('#searchNext').click();
  assert.match(await page.locator('#searchSummary').textContent(),/第 21–40 筆/);
  const secondPage=await page.evaluate(()=>searchHits.slice(20,40).reduce((n,hit)=>n+hit.group.items.length,0));
  await expectCount(pageButton,secondPage);
  await pageButton.click();
  assert.equal((await selected()).length,firstPage+secondPage);
  await expectCount(allButton,all.length-firstPage-secondPage);
  await allButton.click();
  assert.deepEqual(await selected(),all);
  assert.equal(await allButton.getAttribute('aria-disabled'),'true');
  await allButton.evaluate(button=>button.click());
  assert.deepEqual(await selected(),all);

  await page.reload();
  await page.locator('[data-view=builder]').click();
  await page.selectOption('#searchYear','115');
  await page.selectOption('#searchSession','115年第1次');
  await search('混凝土');
  const filtered=await expected();
  assert(filtered.length>0&&filtered.length<all.length);
  await expectCount(allButton,filtered.length);
  await allButton.click();
  assert.deepEqual(await selected(),filtered);
  await page.locator('#viewSelection').click();
  const groupRow=page.locator('#selectionItems .saved-row').filter({hasText:/情境題・整組 [2-6] 題/}).first();
  const groupSize=Number((await groupRow.textContent()).match(/整組 (\d+) 題/)[1]);
  await groupRow.getByRole('button').click();
  assert.equal((await selected()).length,filtered.length-groupSize);
  await page.locator('#closeSelection').click();
  await expectCount(allButton,groupSize);
  await allButton.click();
  assert.deepEqual(await selected(),filtered);
  await page.reload();
  await page.locator('[data-view=builder]').click();
}

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
  assert(await page.locator('#searchBulkActions').isHidden());
  await search('<無此題>');
  assert.match(await page.locator('#searchSummary').textContent(),/找不到/);
  assert(await page.locator('#searchBulkActions').isHidden());
  await page.locator('#viewSelection').click();
  assert(await page.locator('#startCustom').isDisabled());
  await page.keyboard.press('Escape');
  await verifyBulk(page,search);
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

async function verifyNamedGroups(browser,entry,width){
  const context=await browser.newContext({viewport:{width,height:844},colorScheme:width===390?'dark':'light'});
  const page=await context.newPage(),dialogs=[],errors=[];
  let cancelClear=true;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>{
    dialogs.push(dialog.message());
    return cancelClear&&dialog.message().includes('清空目前題單')?dialog.dismiss():dialog.accept();
  });
  await page.goto(new URL(entry,process.env.QUIZ_TEST_BASE_URL).href);
  await page.evaluate(()=>{
    const exam=DATA[0],origin={examId:exam.id,number:1},createdAt='2026-01-01T00:00:00Z';
    localStorage.setItem(DRAFTS_KEY,JSON.stringify({[exam.id]:{id:'previous-draft',ordinal:1,answers:{1:'A'},elapsedMs:42000}}));
    localStorage.setItem(CUSTOM_PRACTICES_KEY,JSON.stringify({'custom-previous':{items:[origin],createdAt}}));
    localStorage.setItem(RUNS_KEY,JSON.stringify({'custom-previous':[{id:'previous-run',ordinal:1,points:2,maxPoints:2,elapsedMs:42000}]}));
  });
  await page.locator('[data-view=builder]').click();
  const search=async term=>{
    await page.locator('#searchTerm').fill(term);
    await page.locator('#searchTerm').press('Enter');
  };
  const field=page.locator('#groupName'),save=page.locator('#saveGroup'),clear=page.locator('#clearSelection');
  const notice=page.locator('#selectionNotice'),title='潛盾 <複習>';
  await page.locator('#viewSelection').click();
  assert(await clear.isDisabled());
  assert(await save.isDisabled());
  await page.locator('#closeSelection').click();

  await search('潛盾');
  const scenario=page.locator('.search-result').filter({hasText:'115年第1次・第1類科A卷・原卷第 32、33 題'});
  await scenario.getByRole('button',{name:'加入整組 2 題'}).click();
  await page.locator('#viewSelection').click();
  await field.fill('   ');
  await save.click();
  assert.match(await notice.textContent(),/請輸入題組名稱/);
  await field.fill('  '+title+'  ');
  await page.evaluate(()=>{
    const setItem=Storage.prototype.setItem;
    window.restoreStorage=()=>{Storage.prototype.setItem=setItem;};
    Storage.prototype.setItem=function(key,value){
      if(key===CUSTOM_PRACTICES_KEY)throw new DOMException('Test quota exceeded','QuotaExceededError');
      return setItem.call(this,key,value);
    };
  });
  await save.click();
  assert.match(await notice.textContent(),/無法儲存題組/);
  assert.match(await page.locator('#selectionTotal').textContent(),/共 2 題/);
  await page.evaluate(()=>window.restoreStorage());
  await save.click();
  assert.match(await notice.textContent(),/已儲存/);
  await field.fill('  '+title+'  ');
  await save.click();
  assert.match(await notice.textContent(),/已有同名題組/);
  const saved=await page.evaluate(()=>Object.entries(customDefinitions()).find(([,group])=>group.name));
  assert.equal(saved[1].name,title);
  assert.deepEqual(saved[1].items.map(item=>item.number),[32,33]);

  await page.locator('#closeSelection').click();
  await search('混凝土');
  await page.locator('#addSearchAll').click();
  await page.locator('#viewSelection').click();
  const count=await page.locator('#selectionTotal').textContent();
  assert(Number(count.match(/共 (\d+) 題/)[1])>300);
  for(const button of [clear,save,page.locator('#startCustom')]){
    const box=await button.boundingBox();
    assert(box.y>=0&&box.y+box.height<=844);
  }
  await page.screenshot({path:path.join(output,`大量題單_${entry.includes('dist')?'發佈版':'來源'}_${width}.png`)});
  const beforeClear=await page.evaluate(()=>({...localStorage}));
  await clear.click();
  assert.match(dialogs.at(-1),/清空目前題單/);
  assert.equal(await page.locator('#selectionTotal').textContent(),count);
  cancelClear=false;
  await clear.click();
  assert.match(await notice.textContent(),/已清空/);
  assert.match(await page.locator('#selectionTotal').textContent(),/共 0 題/);
  assert(await clear.isDisabled());
  assert(await save.isDisabled());
  assert.deepEqual(await page.evaluate(()=>({...localStorage})),beforeClear);
  await page.locator('#closeSelection').click();
  assert.equal(await page.locator('#selectionCount').textContent(),'已選 0 題');
  assert.match(await page.locator('#addSearchAll').textContent(),/新增 356 題/);

  await page.reload();
  await page.locator('[data-view=builder]').click();
  const named=page.locator('.custom-attempts').filter({has:page.getByRole('heading',{name:title+'・2 題',exact:true})});
  await named.getByRole('button',{name:'開始練習'}).click();
  assert.equal(await page.locator('#quiz h2').textContent(),title);
  assert.equal(await page.locator('#cards .scenario-group .question').count(),2);
  await page.locator('#backTop').click();
  await named.getByRole('button',{name:'繼續作答'}).click();
  await page.locator('#submit').click();
  await page.locator('#backTop').click();
  await named.getByRole('button',{name:'查看成績與檢討'}).click();
  assert.equal(await page.locator('.review-jump').count(),2);
  await page.locator('#backTop').click();
  await named.getByRole('button',{name:'再做一次'}).click();
  assert.match(dialogs.at(-1),/確定要再做一次/);
  assert.match(await page.locator('#runLabel').textContent(),/第 2 次/);
  await page.locator('#backTop').click();

  await search('ＣＣＤ');
  await page.locator('[data-add-result]').first().click();
  await page.locator('#viewSelection').click();
  await field.fill('立即練習的題組');
  await save.click();
  const stored=await page.evaluate(()=>Object.keys(customDefinitions()));
  await page.locator('#startCustom').click();
  assert.equal(await page.locator('#quiz h2').textContent(),'立即練習的題組');
  assert.deepEqual(await page.evaluate(()=>Object.keys(customDefinitions())),stored);
  await page.locator('#backTop').click();
  await page.locator('[data-view=wrong]').click();
  await page.locator('#clearWrong').click();
  await page.locator('[data-view=builder]').click();
  assert(await named.getByRole('button',{name:'開始練習'}).isVisible());
  assert.deepEqual(await page.evaluate(()=>Object.keys(customDefinitions()).sort()),stored.filter(id=>id!=='custom-previous').sort());
  assert.deepEqual(errors,[]);
  await context.close();
}

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
  try{
    for(const entry of ['index.html','dist/index.html']){
      for(const width of [390,1280]){
        await verify(browser,entry,width);
        await verifyNamedGroups(browser,entry,width);
      }
    }
    console.log('PASS: custom practice, bulk selection, clearing and saved groups across source and Pages builds at 390px and 1280px');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
