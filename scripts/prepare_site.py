"""Build the temporary GitHub Pages artifact in dist; never publish or upload."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
def build():
    site=ROOT/'dist'
    assert not site.is_symlink(), 'Build directory must not be a symlink'
    site.resolve().relative_to(ROOT.resolve())
    data_root=ROOT/'data_set'
    data=json.loads((data_root/'quiz-data.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
    assets={data_root/'quiz-data.js'} | set(data_root.rglob('*.pdf'))
    assert len(list(data_root.rglob('*.pdf')))==65
    for exam in data:
        assert (data_root/exam['pdf']).is_file()
        for item in exam['questions']+exam.get('scenarios',[]):
            if item.get('source',{}).get('image'):
                p=(data_root/item['source']['image']).resolve()
                p.relative_to(data_root.resolve())
                assert p.is_file(),p
                assets.add(p)
    for p in assets:
        assert not p.is_symlink()
    html=(ROOT/'index.html').read_bytes()
    site.mkdir(parents=True,exist_ok=True)
    # dist is a disposable CI build artifact, not a versioned user delivery.
    expected={'index.html':html,'LICENSE':(ROOT/'LICENSE').read_bytes(),'.nojekyll':b''}
    for name in ['src/styles.css','src/app.js']:expected[name]=(ROOT/name).read_bytes()
    for p in assets:expected['data_set/'+p.relative_to(data_root).as_posix()]=p.read_bytes()
    existing={p.relative_to(site).as_posix():p for p in site.rglob('*') if p.is_file()}
    assert not (existing.keys()-expected.keys()),'Unexpected files in public bundle'
    for name,content in expected.items():
        p=site/name;p.resolve().relative_to(site.resolve());p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(content)
    print(f'Ready: {site}; {len(data)} exams, {sum(len(e["questions"]) for e in data)} questions. No upload performed.')
    return site

if __name__=='__main__':
    build()
