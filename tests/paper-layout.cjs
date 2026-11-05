const {chromium}=require('playwright'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.QUIZ_TEST_OUTPUT||path.join(root,'test-results');
(async()=>{
fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE}),reports=[];
 try{for(const entry of ['index.html','dist/index.html'])for(const [width,height] of [[320,568],[360,640],[375,812],[390,844],[430,932],[768,1024],[820,1180],[1024,768],[1099,800],[1100,800],[1280,900],[1440,900],[1920,1080],[844,390],[667,375]]){
  const c=await b.newContext({offline:false,deviceScaleFactor:width<1100?2:1,hasTouch:width<1100,viewport:{width,height}}),p=await c.newPage();await p.goto(new URL(entry,process.env.QUIZ_TEST_BASE_URL).href);
  await p.evaluate(()=>startExam(DATA[0].id));await p.locator('#paperToggle').click();
  await p.waitForFunction(()=>{const a=document.querySelector('.quiz-actions').getBoundingClientRect(),q=document.querySelector('#paperPanel').getBoundingClientRect();return Math.abs(a.top-q.bottom-16)<1;});
  assert.equal(await p.locator('#paperClose,.paper-heading').count(),0);
  assert.equal(await p.locator('#paperPanel .paper-tools').count(),1);
  const toolLayout=await p.locator('#paperPanel').evaluate(panel=>{const row=panel.querySelector('.paper-tools'),stage=panel.querySelector('.paper-stage').getBoundingClientRect(),r=row.getBoundingClientRect(),ys=[...row.querySelectorAll('button')].map(b=>b.getBoundingClientRect().y);return {count:ys.length,singleRow:Math.max(...ys)-Math.min(...ys)<1,belowCanvas:r.y>=stage.bottom};});
  assert.equal(toolLayout.count,10);assert(toolLayout.singleRow&&toolLayout.belowCanvas);
  assert(await p.locator('.paper-tools').evaluate(row=>{const r=row.getBoundingClientRect();return row.scrollWidth<=row.clientWidth&&[...row.children].every(el=>{const b=el.getBoundingClientRect();return b.left>=r.left-.1&&b.right<=r.right+.1;});}));
  await p.locator('#paperFit').click();
  await p.locator('.paper-tools').evaluate(el=>el.scrollLeft=0);
  const geometry=await p.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
   const bar=rect('.quiz-actions'),paper=rect('#paperPanel'),card=rect('#cards .question');
   return {bar,paper,leftGap:innerWidth>=1100?paper.x-card.right:paper.x,centers:['#timer','#runLabel','#timerNote'].map(s=>{const r=rect(s);return r.y+r.height/2;})};
  });
  assert.equal(geometry.bar.x,0);assert.equal(geometry.bar.right,width);assert.equal(geometry.paper.right,width);
  assert.equal(geometry.paper.y,16);assert(Math.abs(geometry.leftGap-16)<1);assert(Math.abs(geometry.bar.y-geometry.paper.bottom-16)<1);
  assert(Math.max(...geometry.centers)-Math.min(...geometry.centers)<1);
  await p.screenshot({path:path.join(out,`${entry==='index.html'?'來源':'發佈版'}_計算紙滿版資訊列_${width}.png`)});
  const canvas=p.locator('#paperCanvas'),bounds=await canvas.boundingBox();assert(bounds.height>0&&bounds.width>0);
  await p.mouse.move(bounds.x+20,bounds.y+20);await p.mouse.down();await p.mouse.move(bounds.x+60,bounds.y+50,{steps:5});await p.mouse.up();
  const ink=await p.evaluate(()=>JSON.stringify(run.paper));assert(JSON.parse(ink).length>0);
  await p.setViewportSize({width:width<1100?1280:390,height:844});
  await p.waitForFunction(()=>{const a=document.querySelector('.quiz-actions').getBoundingClientRect(),q=document.querySelector('#paperPanel').getBoundingClientRect();return Math.abs(a.top-q.bottom-16)<1;});
  assert.equal(await p.evaluate(()=>JSON.stringify(run.paper)),ink);
  assert(await p.locator('.paper-tools').evaluate(row=>row.scrollWidth<=row.clientWidth));
  await p.locator('#paperToggle').click();assert(!(await p.locator('#paperPanel').isVisible()));
  await p.locator('#paperToggle').click();assert.equal(await p.evaluate(()=>JSON.stringify(run.paper)),ink);
  assert(await p.locator('#paperFit').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  reports.push({entry,width,height,fullWidthBar:true,rightEdgeZero:true,equal16pxGaps:true,verticalCenters:true,allToolsVisible:true,drawAndResizePreservesInk:true});await c.close();
 }}finally{await b.close();}
 fs.writeFileSync(path.join(out,'計算紙版面驗證_V2.6.8.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exitCode=1;});
