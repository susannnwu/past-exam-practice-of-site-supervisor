import json
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
(ROOT/'data_set/interim').mkdir(parents=True,exist_ok=True)
data = json.loads((ROOT/'data_set/quiz-data.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
result = []
for exam in data:
    pages = []
    with pdfplumber.open(ROOT/'data_set'/exam['pdf']) as doc:
        for i, p in enumerate(doc.pages):
            pages.append({'page':i+1,'width':p.width,'height':p.height,'tables':[
                {'bbox':t.bbox,'rows':[{'cells':r.cells,'text':txt} for r,txt in zip(t.rows,t.extract())]}
                for t in p.find_tables()]})
    result.append({'id':exam['id'],'pdf':exam['pdf'],'pages':pages})
(ROOT/'data_set/interim/tables.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
print('Extracted',len(result),'exams')
