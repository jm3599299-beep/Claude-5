// node canal/marca/generar.js <fondo_banner.jpg> [--guias]
// Genera banner.png (2560x1440) y avatar.png (800x800) en canal/marca/.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const fondo = 'data:image/jpeg;base64,' + fs.readFileSync(process.argv[2]).toString('base64');
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.error('PAGEERR', e.message));
  await p.goto('file://' + path.join(__dirname, 'marca.html'));
  if (process.argv.includes('--guias')) await p.evaluate(() => (window.GUIAS = true));
  for (const [modo, out] of [['banner', 'banner.png'], ['avatar', 'avatar.png']]) {
    const url = await p.evaluate(async ([m, f]) => { await render(m, f); return document.getElementById('c').toDataURL('image/png'); }, [modo, fondo]);
    fs.writeFileSync(path.join(__dirname, process.argv.includes('--guias') ? 'guias_' + out : out), Buffer.from(url.split(',')[1], 'base64'));
    console.log('ok', out);
  }
  await b.close();
})();
