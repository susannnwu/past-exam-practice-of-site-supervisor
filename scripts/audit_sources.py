"""Read source PDFs afresh: exam identity, question/option cells, and answer columns.
Does not import the rebuild script or use its cached tables. Whitespace-only
differences are ignored, not mathematical symbols, punctuation, or characters.
"""
from pathlib import Path
import json,re,hashlib,csv,os
import pdfplumber
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('QUIZ_TEST_OUTPUT',str(ROOT/'test-results')))/'source-audit'
OUT.mkdir(parents=True,exist_ok=True)
def compact(s):return re.sub(r'\s+','',s or '')
def form(s):
 s=s.replace('第一','第1').replace('第二','第2')
 m=re.search(r'第([12])類',s)
 letters=re.findall('[AB]',s)
 assert m and len(set(letters))==1,s
 return (int(m[1]),letters[0])
def norm_answer(s):
 s=compact(s)
 if s=='送分':return s
 assert re.fullmatch(r'[ABCD或、/,]+',s),repr(s)
 return '、'.join(sorted(set(re.findall('[ABCD]',s))))
def load():return json.loads((ROOT/'data_set/quiz-data.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
def audit():
 data=load();answer_sources={};answer_rows=[];diffs=[];text_issues=[];options_notes=[];proof=[]
 for session in sorted({e['session'] for e in data}):
  p=next((ROOT/'data_set'/session).glob('*答案*.pdf'))
  entries={}
  with pdfplumber.open(p) as doc:
   assert len(doc.pages)==1
   page=doc.pages[0]
   # dedupe_chars removes identical overprinted glyphs (e.g. D printed twice).
   tables=page.dedupe_chars(tolerance=1).extract_tables()
   table=next(t for t in tables if any(len(row)==8 and compact(row[0])=='1' for row in t))
   header=next(row for row in table if len(row)==8 and all(row[i] and '類' in row[i] for i in (0,2,4,6)))
   forms=[form(header[i]) for i in (0,2,4,6)];assert len(set(forms))==4
   for row in table:
    if len(row)!=8 or not compact(row[0]).isdigit():continue
    for j,identity in enumerate(forms):
     n=int(compact(row[j*2]));assert 1<=n<=50
     key=(*identity,n);assert key not in entries
     entries[key]=norm_answer(row[j*2+1])
   assert len(entries)==200,(session,len(entries))
   # A separate, line-based pass must agree with the table cell extraction.
   lines=page.dedupe_chars(tolerance=1).extract_text().splitlines()
   pairs={}
   for line in lines:
    m=re.fullmatch(r'\s*(\d+)\s+(.+?)\s+(\d+)\s+(.+?)\s+(\d+)\s+(.+?)\s+(\d+)\s+(.+?)\s*',line)
    if not m:continue
    for j,identity in enumerate(forms):pairs[(*identity,int(m[2*j+1]))]=norm_answer(m[2*j+2])
   assert entries==pairs,(session,'table and independent line parsing differ')
   page.to_image(resolution=110).save(OUT/f'答案原頁_{session}.png')
  answer_sources[session]=entries
  proof.append({'path':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'answerEntries':len(entries),'columnHeaders':[list(x) for x in forms]})
 for exam in data:
  identity=form(exam['sheet']);p=ROOT/'data_set'/exam['pdf'];seen={};scenarios=[]
  with pdfplumber.open(p) as doc:
   cover=compact(doc.pages[0].extract_text())
   cover_id=re.search(r'第([一二12])類科[（(]([AB])',cover)
   assert cover_id and (int(cover_id[1].replace('一','1').replace('二','2')),cover_id[2])==identity,(exam['id'],'cover form mismatch')
   assert str(exam['year'])+'年度' in cover
   session_number=re.search(r'第(\d+)次',exam['session'])[1]
   assert '第'+{'1':'一','2':'二','3':'三'}[session_number]+'次' in cover,(exam['id'],'cover session mismatch')
   for i,page in enumerate(doc.pages,1):
    for table in page.find_tables():
     if table.bbox[2]-table.bbox[0]<450:continue
     for row,texts in zip(table.rows,table.extract()):
      cells=[(c,t) for c,t in zip(row.cells,texts) if c]
      if len(cells)==1 and cells[0][0][2]-cells[0][0][0]>450 and compact(cells[0][1]):
       scenarios.append((i,cells[0][0],cells[0][1]));continue
      if len(cells)!=3 or not compact(cells[0][1]).isdigit():continue
      n=int(compact(cells[0][1]))
      if not 1<=n<=50:continue
      assert n not in seen,(exam['id'],n)
      text=cells[2][1] or ''
      # The source has two B/B misprints, handled by physical option position.
      matches=list(re.finditer(r'(?m)^[ \t]*([A-D])(?:[ \t]*[.．、][ \t]*|[ \t]+)',text))
      if len(matches)!=4:
       text=text.replace('B「.','B.「');matches=list(re.finditer(r'(?m)^[ \t]*([A-D])(?:[ \t]*[.．、][ \t]*|[ \t]+)',text))
      assert len(matches)==4,(exam['id'],n,text)
      labels=''.join(m[1] for m in matches)
      if labels!='ABCD':options_notes.append({'exam':exam['id'],'number':n,'labels':labels,'note':'Source option labels; map by physical position'})
      opts={k:compact(text[m.end():matches[j+1].start() if j<3 else len(text)]) for j,(k,m) in enumerate(zip('ABCD',matches))}
      seen[n]={'page':i,'question':compact(cells[1][1]),'options':opts,'bbox':cells[0][0]}
   assert sorted(seen)==list(range(1,51)),exam['id']
   for q in exam['questions']:
    source=seen[q['number']]
    expected=answer_sources[exam['session']][(*identity,q['number'])]
    matched=norm_answer(q['answer'])==expected and q['answer']!='DD'
    row={'exam':exam['id'],'number':q['number'],'questionPDF':exam['pdf'],'page':source['page'],'column':f'{identity[0]}{identity[1]}','current':q['answer'],'official':expected,'answerMatch':matched}
    if not matched:diffs.append(row)
    if source['page']!=q['source']['page'] or abs(source['bbox'][1]-q['source']['bbox'][1])>1:text_issues.append({**row,'field':'source-position'})
    for field in ['question','A','B','C','D']:
     a=source['question'] if field=='question' else source['options'][field]
     b=compact(q['question'] if field=='question' else q['options'][field])
     if a!=b:text_issues.append({**row,'field':field,'pdfText':a,'datasetText':b})
    answer_rows.append(row)
   for g in exam['scenarios']:
    candidates=[s for s in scenarios if s[0]==g['source']['page'] and abs(s[1][1]-g['source']['bbox'][1])<1]
    if len(candidates)!=1 or compact(candidates[0][2])!=compact(g['text']):
     text_issues.append({'exam':exam['id'],'scenario':g['id'],'field':'scenarioText','candidates':len(candidates)})
  print('Checked',exam['id'],flush=True)
 result={'exams':len(data),'questions':len(answer_rows),'optionCells':len(answer_rows)*4,'scenarios':sum(len(e['scenarios']) for e in data),'answerMismatches':diffs,'textDifferences':text_issues,'sourceLabelNotes':options_notes,'answerSources':proof,'scope':'Fresh PDF table + independent answer text-line comparison; whitespace normalized. Not a manual audit of every glyph, diagram or technical correctness; local PDFs only.'}
 (OUT/'來源稽核_V2.3.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 with (OUT/'逐題答案對照_V2.3.csv').open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=answer_rows[0]);w.writeheader();w.writerows(answer_rows)
 print(json.dumps({k:len(v) if isinstance(v,list) else v for k,v in result.items() if k!='scope'},ensure_ascii=False))
 assert not diffs and not text_issues,'Source audit failed; see persisted report for differences.'
if __name__=='__main__':audit()
