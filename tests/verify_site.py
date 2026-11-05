"""Check the Pages artifact, documentation and HTTP links at the repo subpath."""
from pathlib import Path
import functools,json,os,re,threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import quote
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'dist'
OUT=Path(os.environ.get('QUIZ_TEST_OUTPUT',str(ROOT/'test-results')))
OUT.mkdir(parents=True,exist_ok=True)
data=json.loads((ROOT/'data_set/quiz-data.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
images={x['source']['image'] for e in data for x in e['questions']+e['scenarios'] if x['source'].get('image')}
pdfs=list((ROOT/'data_set').rglob('*.pdf'))
assert len(data)==48 and sum(len(e['questions']) for e in data)==2400
assert len(images)==410 and len(pdfs)==65
paths=['index.html','src/app.js','src/styles.css','data_set/quiz-data.js','LICENSE']
paths+=['data_set/'+p.relative_to(ROOT/'data_set').as_posix() for p in pdfs]
paths+=['data_set/'+p for p in sorted(images)]
expected=set(paths)|{'.nojekyll'}
assert {p.relative_to(SITE).as_posix() for p in SITE.rglob('*') if p.is_file()}==expected
for rel in paths:assert (ROOT/rel).read_bytes()==(SITE/rel).read_bytes(),rel
title='工地主任歷屆試題模擬練習'
html=(SITE/'index.html').read_text(encoding='utf-8')
assert f'<title>{title}</title>' in html and f'<h1>{title}</h1>' in html
docs=0
for p in [ROOT/'README.md',*list((ROOT/'docs').glob('*.md'))]:
    for target in re.findall(r'\]\(([^)]+)\)',p.read_text(encoding='utf-8')):
        if '://' in target or target.startswith('#'):continue
        assert (p.parent/target.split('#')[0]).exists(),(p,target)
        docs+=1
slug=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['name']
prefix='/'+slug+'/'
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if not self.path.startswith(prefix):self.send_error(404);return
        self.path='/'+self.path[len(prefix):]
        super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(SITE)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    for rel in paths:
        with urlopen(f'http://127.0.0.1:{server.server_port}'+prefix+quote(rel,safe='/'),timeout=10) as response:
            raw=response.read();assert response.status==200 and raw,rel
            if rel.endswith('.pdf'):assert raw.startswith(b'%PDF-')
            if rel.endswith('.png'):assert raw.startswith(b'\x89PNG')
finally:server.shutdown();server.server_close()
report={'website_name':title,'project_subpath':prefix,'exams':48,'questions':2400,'pdfs':65,'images':410,'artifact_files':len(expected),'http_links':len(paths),'documentation_links':docs,'output_is_pages_build_only':True}
(OUT/'pages-artifact.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
