// PLACEHOLDER — remplacé par les vraies éditions
window.EDITIONS = Array.from({length: 10}, (_, i) => ({
  year: String(2017 + i), published: 'JANVIER ' + (2017 + i), title: 'Titre de l’édition ' + (2017 + i),
  signal: 'Phrase signal de l’année, sur une ou deux lignes, pour tester la mise en page du bas de l’écran.',
  accent: ['#e2533a', '#6a3df0', '#0f9d8a', '#d98a00', '#c2337a'][i % 5], img: i===0 ? 'radars/2026.jpg' : '', crop: {cx:.495, cy:.586, r:.383}, rings: [.24,.43,.65,.88,1], source: 'https://www.wavestone.com',
  themes: [
    {t: 'Résilience opérationnelle', k: 'reconstruire vite', d: 'Détail du thème.'},
    {t: 'Intelligence artificielle et nouvelles surfaces d’attaque', k: 'IA générative', d: 'Détail du thème.'},
    {t: 'Zero Trust', k: 'identité au centre', d: 'Détail.'},
    {t: 'Réglementation', k: 'NIS 2, DORA', d: 'Détail.'},
  ].slice(0, 3 + (i % 3) > 4 ? 4 : 3 + (i % 2)),
}));
