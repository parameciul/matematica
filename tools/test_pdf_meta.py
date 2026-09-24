# Tests for tools/pdf_meta.py. Run: python -m pytest tools -q
import json
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pdf_meta  # noqa: E402


def material(**extra):
    m = {
        'uid': '9901', 'slug': 'fisa', 'topic': 'reale', 'kind': 'fisa-lucru',
        'title': {'ro': 'Fișă de lucru: modul', 'en': 'Worksheet: absolute value'},
        'description': {'ro': 'Fișă de lucru de clasa a IX-a despre modulul unui număr real.', 'en': 'Grade 9 worksheet.'},
        'pdf': 'materiale/pdf/fisa-9901.pdf',
    }
    m.update(extra)
    return m


def make_site(tmp_path, materials, author='Profesor X', xmp=True):
    (tmp_path / 'data').mkdir(parents=True)
    (tmp_path / 'materiale' / 'pdf').mkdir(parents=True)
    data = {'topics': [{'id': 'reale', 'grade': 9}, {'id': 'recap', 'grade': 11}], 'materials': materials}
    (tmp_path / 'data' / 'materials.source.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf8')
    for m in materials:
        if not m.get('pdf'):
            continue
        doc = pymupdf.open()
        doc.new_page().insert_text((72, 72), 'Exercitiul 1', fontname='helv', fontsize=11)
        doc.set_metadata({'author': author, 'title': 'Draft 9R2', 'creator': 'Word'})
        if xmp:
            doc.set_xml_metadata('<x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta>')
        doc.save(str(tmp_path / m['pdf']))
    return tmp_path


def test_title_adds_both_grade_forms():
    assert pdf_meta.wanted(material(), 9)['title'] == 'Fișă de lucru: modul – clasa a 9-a (IX)'


def test_title_that_names_a_class_gets_no_grade():
    m = material(title={'ro': 'Fișă recapitulativă: geometrie (clasa a X-a)', 'en': 'x'})
    assert pdf_meta.wanted(m, 11)['title'] == 'Fișă recapitulativă: geometrie (clasa a X-a)'


def test_seo_title_wins_over_the_title():
    m = material(seoTitle={'ro': 'Modul: fișă de lucru', 'en': 'x'})
    assert pdf_meta.wanted(m, 9)['title'] == 'Modul: fișă de lucru – clasa a 9-a (IX)'


def test_subject_and_keywords_come_from_the_data():
    m = material(keywords={'ro': ['modul', 'clasa a 9-a'], 'en': ['grade 9']})
    meta = pdf_meta.wanted(m, 9)
    assert meta['author'] == 'Laura Miron'
    assert meta['subject'] == m['description']['ro']
    assert meta['keywords'] == 'modul, clasa a 9-a'
    assert pdf_meta.wanted(material(), 9)['keywords'] == ''


def test_write_replaces_the_source_metadata_and_keeps_the_pages(tmp_path):
    root = make_site(tmp_path, [material()])
    pdf = root / 'materiale' / 'pdf' / 'fisa-9901.pdf'
    assert pdf_meta.main([], root=root) == 0
    doc = pymupdf.open(str(pdf))
    assert doc.metadata['title'] == 'Fișă de lucru: modul – clasa a 9-a (IX)'
    assert doc.metadata['author'] == 'Laura Miron'
    assert doc.metadata['creator'] == ''
    assert doc.language == 'ro'
    assert not doc.get_xml_metadata()
    assert 'Exercitiul 1' in doc[0].get_text()
    assert '9R2' not in str(doc.metadata)


def test_a_second_run_changes_no_bytes(tmp_path):
    root = make_site(tmp_path, [material()])
    pdf = root / 'materiale' / 'pdf' / 'fisa-9901.pdf'
    pdf_meta.main([], root=root)
    first = pdf.read_bytes()
    assert pdf_meta.write(pdf, pdf_meta.wanted(material(), 9)) is False
    pdf_meta.main([], root=root)
    assert pdf.read_bytes() == first


def test_writing_twice_from_the_same_source_gives_the_same_bytes(tmp_path):
    a = make_site(tmp_path / 'a', [material()])
    b = make_site(tmp_path / 'b', [material()])
    rel = Path('materiale') / 'pdf' / 'fisa-9901.pdf'
    (b / rel).write_bytes((a / rel).read_bytes())
    pdf_meta.main([], root=a)
    pdf_meta.main([], root=b)
    assert (a / rel).read_bytes() == (b / rel).read_bytes()


def test_check_fails_until_the_metadata_is_written(tmp_path, capsys):
    root = make_site(tmp_path, [material()])
    assert pdf_meta.main(['--check'], root=root) == 1
    assert 'STALE: materiale/pdf/fisa-9901.pdf' in capsys.readouterr().err
    pdf_meta.main([], root=root)
    assert pdf_meta.main(['--check'], root=root) == 0


def test_check_fails_after_the_title_changes(tmp_path):
    root = make_site(tmp_path, [material()])
    pdf_meta.main([], root=root)
    file = root / 'data' / 'materials.source.json'
    data = json.loads(file.read_text(encoding='utf8'))
    data['materials'][0]['title']['ro'] = 'Fișă nouă'
    file.write_text(json.dumps(data, ensure_ascii=False), encoding='utf8')
    assert pdf_meta.main(['--check'], root=root) == 1


def test_one_uid_touches_only_that_pdf(tmp_path):
    other = material(uid='9902', slug='alta', pdf='materiale/pdf/alta-9902.pdf')
    root = make_site(tmp_path, [material(), other])
    before = (root / other['pdf']).read_bytes()
    assert pdf_meta.main(['9901'], root=root) == 0
    assert (root / other['pdf']).read_bytes() == before
    assert pdf_meta.main(['--check', '9901'], root=root) == 0


def test_material_without_pdf_is_skipped_and_unknown_uid_fails(tmp_path):
    root = make_site(tmp_path, [material(), material(uid='9903', slug='joc', pdf=None)])
    assert pdf_meta.main([], root=root) == 0
    assert pdf_meta.main(['1234'], root=root) == 1


def test_missing_pdf_file_fails(tmp_path):
    root = make_site(tmp_path, [material()])
    (root / 'materiale' / 'pdf' / 'fisa-9901.pdf').unlink()
    assert pdf_meta.main([], root=root) == 1


def test_every_committed_pdf_holds_its_metadata():
    # The site itself: a changed title, seoTitle, description or keywords
    # needs `python tools/pdf_meta.py` before the commit.
    assert pdf_meta.main(['--check']) == 0
