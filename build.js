#!/usr/bin/env node
/**
 * build.js — Reconstruit Findium.html en remplaçant les blocs JSX modifiés.
 * Usage : node build.js
 */
const fs   = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, 'Findium.html');
const SRC_DIR   = path.join(__dirname, 'src');

// Map : identifiant unique dans le bloc existant → fichier source à injecter
const REPLACEMENTS = [
  { marker: 'data.jsx — Données de démonstration',          src: 'data.jsx'          },
  { marker: 'graph.jsx — Visualisations graphiques',         src: 'graph.jsx'         },
  { marker: 'screens.jsx — Écrans principaux',               src: 'screens.jsx'       },
  { marker: 'findium — Effacement (data brokers',        src: 'effacement.jsx'    },
  { marker: 'investigation.jsx — Vue détaillée',             src: 'investigation.jsx' },
  { marker: 'app.jsx — Shell principal',                     src: 'app.jsx'           },
];

let html = fs.readFileSync(HTML_FILE, 'utf8');
let replaced = 0;

for (const { marker, src } of REPLACEMENTS) {
  const srcContent = fs.readFileSync(path.join(SRC_DIR, src), 'utf8');

  // Find the <script type="text/babel"> block that contains this marker
  // Pattern: <script type="text/babel">\n...marker...\n</script>
  const openTag  = '<script type="text/babel">';
  const closeTag = '</script>';

  let cursor = 0;
  while (cursor < html.length) {
    const openIdx = html.indexOf(openTag, cursor);
    if (openIdx === -1) break;

    const contentStart = openIdx + openTag.length;
    const closeIdx     = html.indexOf(closeTag, contentStart);
    if (closeIdx === -1) break;

    const blockContent = html.slice(contentStart, closeIdx);

    if (blockContent.includes(marker)) {
      // Replace this block's content with the current source file
      html = html.slice(0, contentStart) + '\n' + srcContent + '\n  ' + html.slice(closeIdx);
      console.log(`✓ Replaced: ${src}`);
      replaced++;
      break;
    }
    cursor = closeIdx + closeTag.length;
  }
}

if (replaced === 0) {
  console.error('No blocks replaced — check marker strings.');
  process.exit(1);
}

fs.writeFileSync(HTML_FILE, html, 'utf8');
const kb = Math.round(fs.statSync(HTML_FILE).size / 1024);
console.log(`\nFindium.html rebuilt — ${kb} KB (${replaced}/${REPLACEMENTS.length} blocks replaced)`);
