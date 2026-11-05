"""Structural regression checks; this does not certify every word or answer."""
import json,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('QUIZ_TEST_OUTPUT',str(ROOT/'test-results')));OUT.mkdir(parents=True,exist_ok=True)

def read(path): return json.loads(path.read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
data=read(ROOT/'data_set/quiz-data.js')
old=read(ROOT/'tests/fixtures/quiz-data.before.js')
assert len(data)==48
cross_page=[]
for exam,before in zip(data,old):
    assert exam['id']==before['id']
    assert (ROOT/'data_set'/exam['pdf']).is_file()
    assert [q['number'] for q in exam['questions']]==list(range(1,51))
    corrections=json.loads((ROOT/'tests/fixtures/answer-corrections-v2.3.json').read_text(encoding='utf-8'))
    corrected={(x['exam'],x['number']):x['after'] for x in corrections}
    assert [q['answer'] for q in exam['questions']]==[corrected.get((exam['id'],q['number']),q['answer']) for q in before['questions']]
    groups={s['id']:s for s in exam['scenarios']}
    for q in exam['questions']:
        assert q['question'].strip() and set(q['options'])==set('ABCD')
        assert all(x.strip() for x in q['options'].values())
        # Independently verify each association against source reading order.
        preceding=[s for s in exam['scenarios'] if (s['source']['page'],s['source']['bbox'][1]) < (q['source']['page'],q['source']['bbox'][1])]
        assert q.get('scenarioId')==(preceding[-1]['id'] if preceding else None)
    for s in exam['scenarios']:
        assert s['numbers']==[q['number'] for q in exam['questions'] if q.get('scenarioId')==s['id']]
        if len({exam['questions'][n-1]['source']['page'] for n in s['numbers']}|{s['source']['page']})>1:
            cross_page.append({'exam':exam['id'],'numbers':s['numbers']})
    for obj in exam['questions']+exam['scenarios']:
        if obj['source'].get('image'): assert (ROOT/'data_set'/obj['source']['image']).is_file()
sample=next(e for e in data if e['id']=='115年第1次-115年第1次_第1類科A卷')
assert sample['scenarios'][0]['numbers']==[32,33] and '潛盾' in sample['scenarios'][0]['text']
assert sample['scenarios'][1]['numbers']==[34,35] and '懸吊施工架' in sample['scenarios'][1]['text']
sample=next(e for e in data if e['id']=='114年第1次-114年第1次_第2類科B卷')
assert sample['scenarios'][1]['numbers']==[34,35]
assert sample['questions'][33]['source']['page']==5 and sample['questions'][34]['source']['page']==6
sample=next(e for e in data if e['id']=='114年第1次-114年第1次_第1類科A卷')
assert '對專業的責任' in sample['questions'][36]['question']
sample=next(e for e in data if e['id']=='113年第3次-113年第3次_第1類科A卷')
assert sample['questions'][40]['options']['B']=='密級配、油溶瀝青。'
assert sample['questions'][40]['options']['C']=='密級配、改質瀝青。'
changed=sum(q['question']!=o['question'] or q['options']!=o['options'] for e,b in zip(data,old) for q,o in zip(e['questions'],b['questions']))
summary={'exams':48,'questions':2400,'scenarios':sum(len(e['scenarios']) for e in data),'changedQuestions':changed,'crossPageGroups':cross_page,'scope':'Automated structure and targeted regression checks; not full manual transcription or answer verification.'}
(OUT/'quiz-structure.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS:',len(data),'exams, 2400 questions;',summary['scenarios'],'scenarios;',len(cross_page),'cross-page groups;',changed,'changed questions')
