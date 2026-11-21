"""Construit cyber-book/data.js depuis l'export JSON du classeur « Radars RSSI - mots clés ».
Usage : python3 -I tools/build-cyber-book-data.py <export.json> cyber-book/data.js
Seules les éditions publiées (2011-2026) sont reprises : le projet 2027 et les notes internes restent hors du site public."""
import json, sys, re, collections
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))
YEARS = [str(y) for y in range(2011, 2027)]

FAM = [  # famille de couleur, ordre autour du radar, motifs de reconnaissance
    ('idt', ['identity', 'identité']),
    ('pro', ['protect', 'protection', 'cybersécurité', 'cybersecurity']),
    ('det', ['detect']),
    ('rsk', ['risk', 'gouvernance']),
    ('cmp', ['compliance']),
    ('res', ['resilience', 'continuity', 'continuité']),
]
def fam(cat):
    c = cat.lower()
    for k, pats in FAM:
        if any(p in c for p in pats): return k
    raise SystemExit('catégorie inconnue : ' + cat)
def nice(cat):
    c = cat.strip()
    if c.isupper(): c = c.title().replace(' And ', ' and ')
    return c.replace('Operation Resilience', 'Operational Resilience')
def ring(m):
    m = (m or '').split('/')[0].strip().lower()
    if m.startswith(('mature', 'maturité', 'très')): return 0
    if m.startswith(('trending', 'actualité')): return 1
    if m.startswith(('emerging', 'émergence')): return 2
    return None

def grid(name):
    s = [x for x in d['sheets'] if x['name'] == name][0]; g = {}
    for c in s['cells']:
        v = c.get('cached_value') if c.get('data_type') == 'f' else c.get('value')
        g.setdefault(c['row'], {})[c['column']] = v
    return g

# Fils terminologiques de la frise : une ligne = un sujet suivi d'année en année.
fr = grid('Frise chronologique'); ycol = {str(v): k for k, v in fr[1].items() if isinstance(v, int) and v <= 2026}
norm = lambda s: re.sub(r'\s+', ' ', str(s)).strip().lower()
subj, where = [], {}
for r in sorted(fr):
    row = fr[r]; name = row.get(1)
    if r < 2 or not name or not any(row.get(ycol[y]) for y in YEARS): continue
    lv = {}
    for y in YEARS:
        lab = row.get(ycol[y])
        if lab:
            m = ring(row.get(ycol[y] + 19)); lv[y] = m
            where.setdefault((y, norm(lab)), len(subj))
    subj.append({'n': str(name).split('→')[-1].strip(), 'y': lv})

summary = {r['Année']: r for r in d['llm_ready']['summary_sheet']['records']}
EDS, hit, miss = [], 0, []
for a in d['llm_ready']['annual_sheets']:
    y = str(a['sheet'])
    if y not in YEARS: continue
    hdr = {h['field']: h['value'] for h in a['annual_header']}
    quads, kws = {}, []
    for r in a['keyword_table']['records']:
        w, cat, m = r.get('Mot-clé'), r.get('Catégorie'), ring(r.get('Niveau de maturité'))
        if not w or not cat or m is None: continue
        cat = cat.split(' / ')[0]; f = fam(cat)
        quads.setdefault(f, nice(cat))
        t = where.get((y, norm(w)))
        if t is None: miss.append((y, w))
        else: hit += 1
        k = {'w': re.sub(r'\s+', ' ', str(w)).strip(), 'f': f, 'r': m}
        mean = r.get('Acronyme / signification')
        if mean: k['m'] = re.sub(r'\s+', ' ', str(mean)).strip()
        if t is not None: k['t'] = t
        kws.append(k)
    order = [k for k, _ in FAM if k in quads]
    st = summary[y]['Statut de complétude']
    EDS.append({'y': y, 'name': str(hdr.get('Nom exact du radar') or '').strip(), 'quads': [[k, quads[k]] for k in order],
                'check': 'non vérifi' in st or 'estim' in (summary[y]['Commentaire'] or '') or 'OCR' in st, 'kw': kws})
# On ne garde que les sujets réellement reliés, renumérotés.
used = sorted({k['t'] for e in EDS for k in e['kw'] if 't' in k}); ren = {o: i for i, o in enumerate(used)}
for e in EDS:
    for k in e['kw']:
        if 't' in k: k['t'] = ren[k['t']]
SUB = [{'n': subj[o]['n'], 'y': {y: v for y, v in subj[o]['y'].items()}} for o in used]
with open(out, 'w') as fh:
    fh.write('// Généré par tools/build-cyber-book-data.py depuis le classeur « Radars RSSI - mots clés ». Ne pas modifier à la main.\n')
    fh.write('// f = famille de cadran, r = anneau (0 mature, 1 trending, 2 emerging), m = signification, t = index du sujet suivi dans SUBJECTS.\n')
    fh.write('window.RADARS = ' + json.dumps(EDS, ensure_ascii=False, separators=(',', ':')) + ';\n')
    fh.write('window.SUBJECTS = ' + json.dumps(SUB, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('éditions', len(EDS), 'mots-clés', sum(len(e['kw']) for e in EDS), 'reliés', hit, 'non reliés', len(miss), 'sujets', len(SUB))
print(miss[:25])
for e in EDS: print(e['y'], len(e['kw']), [q[1] for q in e['quads']], 'à vérifier' if e['check'] else '')
