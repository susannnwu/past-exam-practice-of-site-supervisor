"""Rebuild question/scenario associations from PDF cell boundaries, never prose prefixes.

Run inspect_tables.py first. Answers and stable exam/question IDs are retained.
Every source rectangle is recorded for audit; original crops preserve diagrams.
"""
import argparse
import os
import hashlib
import json
import re
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('QUIZ_TEST_OUTPUT',str(ROOT/'test-results')))/'source-rebuild'
def clean(s):
    # Join Chinese text broken only by PDF line wrapping. Preserve ordinary
    # spaces (English words, numbers/units, and spaces present within a line).
    s=(s or '').replace('\r\n','\n').replace('\r','\n')
    cjk=r'\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef'
    s=re.sub(r'(?<=['+cjk+r'])[^\S\n]*\n[^\S\n]*(?=['+cjk+r'])','',s)
    return re.sub(r'\s+', ' ', s).strip()

def options(s):
    s=s.replace('B「.', 'B. 「')
    matches = list(re.finditer(r'(?m)^[ \t]*([A-D])(?:[ \t]*[.．、][ \t]*|[ \t]+)', s))
    labels=[m[1] for m in matches]
    assert labels in [list('ABCD'),list('ABBD')],repr(s)
    return {k:clean(s[m.end():matches[i+1].start() if i+1<len(matches) else len(s)]) for i,(k,m) in enumerate(zip('ABCD',matches))}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--images',action='store_true')
    args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    target=ROOT/'data_set/quiz-data.js'
    original=target.read_text(encoding='utf-8')
    backup=ROOT/'tests/fixtures/quiz-data.before.js'
    if not backup.exists(): backup.write_text(original,encoding='utf-8')
    data=json.loads(original.split('=',1)[1].strip().rstrip(';'))
    tables=json.loads((ROOT/'data_set/interim/tables.json').read_text(encoding='utf-8'))
    baseline={e['id']:e for e in json.loads(backup.read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))}
    audit=[]
    assets=ROOT/'data_set/source-crops'
    assets.mkdir(exist_ok=True)
    for exam,source in zip(data,tables):
        assert exam['id']==source['id']
        old={q['number']:q for q in exam['questions']}
        groups=[]; questions=[]; active=None; events=[]
        for p in source['pages']:
            pe=[]
            for t in p['tables']:
                if t['bbox'][2]-t['bbox'][0]<450: continue
                for row in t['rows']:
                    cells=[(c,s) for c,s in zip(row['cells'],row['text']) if c is not None]
                    if not cells: continue
                    c,s=cells[0]; s=clean(s)
                    if re.fullmatch(r'\d{1,2}',s) and 1<=int(s)<=50 and len(cells)==3 and c[2]-c[0]<100:
                        pe.append({'kind':'q','number':int(s),'question':clean(cells[1][1]),'options':options(cells[2][1] or ''),'page':p['page'],'bbox':[c[0],c[1],cells[-1][0][2],max(x[0][3] for x in cells)]})
                    elif len(cells)==1 and c[2]-c[0]>450 and s:
                        pe.append({'kind':'s','text':s,'page':p['page'],'bbox':list(c)})
                    elif s=='題號':
                        pe.append({'kind':'header','page':p['page'],'bbox':list(c)})
            pe.sort(key=lambda e:e['bbox'][1])
            # A scenario can contain a diagram split into several detected tables.
            # Its lower bound is the next question/header, not the first extracted cell.
            for i,e in enumerate(pe):
                if e['kind']=='s' and i+1<len(pe): e['bbox'][3]=max(e['bbox'][3],pe[i+1]['bbox'][1])
            events.extend(pe)
        for e in events:
            if e['kind']=='header': continue
            if e['kind']=='s':
                active={'id':f's{len(groups)+1}','text':e['text'],'source':{'page':e['page'],'bbox':e['bbox']},'numbers':[]}
                groups.append(active)
            else:
                n=e['number']
                q={'number':n,'question':e['question'],'options':e['options'],'answer':old[n]['answer'],'source':{'page':e['page'],'bbox':e['bbox']}}
                if exam['session']=='113年第3次' and (( '第1類科A' in exam['sheet'] and n==41) or ('第1類科B' in exam['sheet'] and n==31)):
                    q['sourceNote']='原卷第三個選項誤標為 B，此處依選項位置標為 C；內容保留原文。'
                if active: q['scenarioId']=active['id']; active['numbers'].append(n)
                questions.append(q)
        assert [q['number'] for q in questions]==list(range(1,51)),exam['id']
        invalid=[q for q in questions if not(q['question'] and set(q['options'])==set('ABCD') and all(q['options'].values()))]
        if invalid: print(exam['id'],json.dumps(invalid,ensure_ascii=False))
        assert all(g['numbers'] for g in groups),exam['id']
        exam['questions']=questions; exam['scenarios']=groups
        if args.images:
            with pdfplumber.open(ROOT/'data_set'/exam['pdf']) as doc:
                for obj in groups+questions:
                    src=obj['source']; page=doc.pages[src['page']-1]; box=src['bbox']
                    # Interior graphics include vector drawings, raster images and nested grids.
                    inner=(box[0]+2,box[1]+2,box[2]-2,box[3]-2)
                    inside=lambda o: o['x0']>=inner[0] and o['x1']<=inner[2] and o['top']>=inner[1] and o['bottom']<=inner[3]
                    overlaps=lambda o: min(o['x1'],inner[2])-max(o['x0'],inner[0])>3 and min(o['bottom'],inner[3])-max(o['top'],inner[1])>3
                    graphic=any(overlaps(o) for o in page.images+page.curves) or any(inside(o) for o in page.lines+page.rects)
                    if 'numbers' in obj or graphic:
                        name=hashlib.sha256((exam['id']+str(src)).encode()).hexdigest()[:16]+'.png'
                        path=assets/name
                        if not path.exists(): page.crop(box).to_image(resolution=144).save(path)
                        src['image']='source-crops/'+name
                        src['hasGraphics']=graphic
        before={q['number']:q for q in baseline[exam['id']]['questions']}
        audit.append({'id':exam['id'],'groups':groups,'questions':len(questions),'changedQuestions':[q['number'] for q in questions if q['question']!=before[q['number']]['question'] or q['options']!=before[q['number']]['options']]})
    assert all(q['question'] and set(q['options'])==set('ABCD') and all(q['options'].values()) for e in data for q in e['questions']), 'Incomplete extraction; original data left unchanged'
    target.write_text('window.QUIZ_DATA = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    (OUT/'rebuild-report.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Exams:',len(data),'Questions:',sum(len(e['questions']) for e in data),'Scenarios:',sum(len(e['scenarios']) for e in data))
    print('Changed:',sum(len(e['changedQuestions']) for e in audit))

if __name__=='__main__': main()
