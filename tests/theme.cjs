const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.QUIZ_TEST_OUTPUT||path.join(root,'test-results');
fs.mkdirSync(out,{recursive:true});
const luminance=s=>{const a=s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE}),reports=[];
 try{for(const entry of ['index.html','dist/index.html']){
  const c=await b.newContext({offline:false,colorScheme:'dark',viewport:{width:390,height:844}}),p=await c.newPage(),errors=[];
  p.on('dialog',d=>d.accept());p.on('pageerror',e=>errors.push(e.message));const url=new URL(entry,process.env.QUIZ_TEST_BASE_URL).href;await p.goto(url);
  const bg=()=>p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  assert.equal(await p.locator('[data-mode][aria-pressed="true"]').getAttribute('data-mode'),'system');assert.equal(await bg(),'rgb(0, 0, 0)');
  await p.emulateMedia({colorScheme:'light'});assert.equal(await bg(),'rgb(245, 245, 247)');
  await p.locator('[data-mode="'+('night')+'"]').click();await p.reload();assert.equal(await p.locator('[data-mode][aria-pressed="true"]').getAttribute('data-mode'),'night');assert.equal(await bg(),'rgb(0, 0, 0)');
  await p.locator('[data-mode="'+('light')+'"]').click();await p.emulateMedia({colorScheme:'dark'});assert.equal(await bg(),'rgb(245, 245, 247)');
  await p.evaluate(()=>{startExam(DATA.find(e=>e.questions.some(q=>q.answer==='送分')).id);run.paper=[{tool:'pen',width:3,points:[[0,0],[100,100]]}];});
  await p.locator('#paperToggle').click();await p.locator('#paperFit').click();const strokes=await p.evaluate(()=>JSON.stringify(run.paper));
  for(const mode of ['light','night']){
   await p.locator('#paperToggle').click();
   await p.locator('[data-mode="'+(mode)+'"]').click();
   await p.locator('#paperToggle').click();
   assert.equal(await p.evaluate(()=>JSON.stringify(run.paper)),strokes);
   assert.equal(await p.locator('#paperCanvas').evaluate(el=>getComputedStyle(el).color),mode==='night'?'rgb(245, 245, 247)':'rgb(29, 29, 31)');
   // Sample a representative opaque ink pixel, not just the CSS color.
   const pixel=await p.locator('#paperCanvas').evaluate(el=>{const d=el.getContext('2d').getImageData(0,0,el.width,el.height).data;for(let i=0;i<d.length;i+=4)if(d[i+3]===255)return d[i];return null;});
   assert.equal(pixel,mode==='night'?245:29);
   const colors=await p.evaluate(()=>['body','.card','.primary','.secondary','#paperPanel'].map(sel=>{const s=getComputedStyle(document.querySelector(sel));return {sel,fg:s.color,bg:s.backgroundColor};}));
   for(const x of colors){const a=luminance(x.fg),z=luminance(x.bg),contrast=(Math.max(a,z)+.05)/(Math.min(a,z)+.05);assert(contrast>=4.5,JSON.stringify({...x,contrast}));}
   await p.screenshot({path:path.join(out,`${entry==='index.html'?'來源':'發佈版'}_${mode}_V2.6.8.png`)});
  }
  await p.locator('#paperToggle').click();await p.evaluate(()=>{const i=current.questions.findIndex(q=>q.answer!=='送分'),q=current.questions[i],k=['A','B','C','D'].find(x=>!answerSet(q.answer).includes(x));document.querySelector(`input[name=q${i}][value=${k}]`).checked=true;submitQuiz();});
  for(const mode of ['light','night']){
   await p.locator('[data-mode="'+(mode)+'"]').click();
   const x=await p.locator('.bonus-notice').evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
   assert((Math.max(luminance(x.fg),luminance(x.bg))+.05)/(Math.min(luminance(x.fg),luminance(x.bg))+.05)>=4.5);
   for(const selector of ['.option.answer-correct','.option.answer-wrong']){
    const v=await p.locator(selector).first().evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
    assert((Math.max(luminance(v.fg),luminance(v.bg))+.05)/(Math.min(luminance(v.fg),luminance(v.bg))+.05)>=4.5);
   }
   await p.locator('.result').scrollIntoViewIfNeeded();
   await p.screenshot({path:path.join(out,`${entry==='index.html'?'來源':'發佈版'}_${mode}_評分_V2.6.8.png`)});
  }
  await p.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('blocked');};});
  await p.locator('[data-mode="'+('light')+'"]').click();assert.equal(await bg(),'rgb(245, 245, 247)');
  assert.deepEqual(errors,[]);await c.close();
  const blocked=await b.newContext({offline:false,colorScheme:'dark'});await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked');};Storage.prototype.setItem=()=>{throw Error('blocked');};});
  const q=await blocked.newPage();await q.goto(url);assert.equal(await q.locator('[data-mode][aria-pressed="true"]').getAttribute('data-mode'),'system');await q.locator('[data-mode="'+('light')+'"]').click();assert.equal(await q.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(245, 245, 247)');await blocked.close();
  reports.push({entry,defaultSystem:true,liveSystemChanges:true,manualOverride:true,reloadPersists:true,storageFailureFallback:true,canvasRedraw:true,inkUnchanged:true,contrastAtLeast4_5:true,servedOverHTTP:true});
 }}finally{await b.close();}
 fs.writeFileSync(path.join(out,'配色驗證_V2.6.8.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exitCode=1;});
