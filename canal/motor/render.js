// node render.js <spec_resuelto.json> <salida.mp4> [--stills t1,t2,...]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const [specPath, outPath, flag, times] = process.argv.slice(2);
const FPS = 30;
(async () => {
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const base = path.dirname(specPath);
  const imgs = spec.escenas.map(e => e.imagen ? 'data:image/jpeg;base64,' + fs.readFileSync(path.resolve(base, e.imagen)).toString('base64') : null);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.error('PAGEERR', e.message));
  await p.goto('file://' + path.join(__dirname, 'plantilla.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(([s, i]) => init(s, i), [spec, imgs]);
  const grab = async t => Buffer.from((await p.evaluate(t => { render(t); return document.getElementById('c').toDataURL('image/jpeg', 0.93); }, t)).split(',')[1], 'base64');
  if (flag === '--stills') {
    const ts = times.split(',').map(Number);
    for (const t of ts) fs.writeFileSync(outPath.replace(/\.\w+$/, '') + `_${t}.jpg`, await grab(t));
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', outPath], { stdio: ['pipe', 'inherit', 'inherit'] });
    const N = Math.round(spec.duracion * FPS);
    for (let i = 0; i < N; i++) {
      const buf = await grab(i / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log(`fotograma ${i}/${N}`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await b.close();
})();
