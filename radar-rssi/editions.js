// PLACEHOLDER — remplacé par les vraies éditions
window.EDITIONS = Array.from({length: 10}, (_, i) => ({
  year: String(2018 + i), published: 'JANVIER ' + (2018 + i), title: 'Titre de l’édition ' + (2018 + i),
  signal: 'Phrase signal de l’année, sur une ou deux lignes, pour tester la mise en page du bas de l’écran.',
  accent: ['#e2533a', '#6a3df0', '#0f9d8a', '#d98a00', '#c2337a'][i % 5], img: i===0 ? 'private/2027.webp' : '', crop: {cx:.510, cy:.607, r:.340}, rings: [.245,.44,.65,.955,1], photo: 'private/photos/' + (2018 + i) + '.jpg', source: 'https://www.wavestone.com',
  themes: [
    {t: 'Résilience opérationnelle', k: 'reconstruire vite', d: 'Détail du thème.'},
    {t: 'Intelligence artificielle et nouvelles surfaces d’attaque', k: 'IA générative', d: 'Détail du thème.'},
    {t: 'Zero Trust', k: 'identité au centre', d: 'Détail.'},
    {t: 'Réglementation', k: 'NIS 2, DORA', d: 'Détail.'},
  ].slice(0, 3 + (i % 3) > 4 ? 4 : 3 + (i % 2)),
}));
