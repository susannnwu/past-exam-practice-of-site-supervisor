// Test the source and Pages artifact over HTTP under a GitHub project subpath.
const {spawn}=require('node:child_process');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const tests=['exam-view','footer-theme','history-review','review-overview','paper-layout','retry-exam','submit-confirm','theme','custom-practice'];
const prefix='/'+require('../package.json').name+'/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.pdf':'application/pdf'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.endsWith('/favicon.ico')){res.writeHead(204);res.end();return;}
    if(!pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
    const rel=pathname.slice(prefix.length)||'index.html';
    const file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)||rel.includes('\\')){res.writeHead(403);res.end();return;}
    const data=await fs.readFile(file);
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}${prefix}`;
  try{
    for(const name of tests){
      process.stdout.write(`Testing ${name} over HTTP\n`);
      const status=await new Promise((resolve,reject)=>{
        const child=spawn(process.execPath,[path.join(root,'tests',name+'.cjs')],{cwd:root,env:{...process.env,QUIZ_TEST_BASE_URL:base},stdio:'inherit'});
        child.once('error',reject);child.once('exit',resolve);
      });
      if(status!==0)throw Error(`${name} failed (exit ${status})`);
    }
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
