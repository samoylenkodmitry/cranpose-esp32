const layout = new URLSearchParams(location.search).get('run');

if (layout === 'demo' || layout === 'dashboard') {
  const section = document.getElementById(layout);
  const player = document.getElementById('player').content.cloneNode(true);
  const screen = player.querySelector('canvas');
  screen.dataset.firmware = `benchmarks/${layout}.bin.gz`;
  screen.setAttribute('aria-label', section.querySelector('img').alt);
  section.querySelector('figure').append(screen);
  const link = section.querySelector('.run');
  link.textContent = 'Stop emulator';
  link.href = `./#${layout}`;
  link.after(player);
  await import('../main.js');
}

const revision = await fetch('revision.txt');
if (revision.ok) {
  const sha = (await revision.text()).trim();
  if (/^[0-9a-f]{40}$/.test(sha)) {
    for (const link of document.querySelectorAll('a[data-source]')) {
      link.href = link.href.replace('/main/', `/${sha}/`);
    }
    document.getElementById('source').textContent = `Benchmark source · ${sha.slice(0, 8)}`;
  }
}
