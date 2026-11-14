// node canal-gta/motor/render.js <anim.html> <subtitulos.json> <duracion> <salida.mp4> [--stills t1,t2,...]
// Renderiza una animación de canvas (window.init(caps,dur) + window.render(t)) a vídeo 1080x1920 a 30 fps.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const [html, capsPath, durS, out, flag, times] = process.argv.slice(2);
const DUR = +durS, FPS = 30;
(async () => {
  const caps = JSON.parse(fs.readFileSync(capsPath, 'utf8'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.error('PAGEERR', e.message));
  await p.goto('file://' + path.resolve(html));
  await p.evaluate(([c, d]) => init(c, d), [caps, DUR]);
  const grab = async t => Buffer.from((await p.evaluate(t => { render(t); return document.getElementById('c').toDataURL('image/jpeg', 0.93); }, t)).split(',')[1], 'base64');
  if (flag === '--stills') {
    for (const t of times.split(',').map(Number)) fs.writeFileSync(out.replace(/\.\w+$/, '') + `_${t}.jpg`, await grab(t));
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const N = Math.round(DUR * FPS);
    for (let i = 0; i < N; i++) {
      const buf = await grab(i / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 300 === 0) console.log(`fotograma ${i}/${N}`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await b.close();
})();
