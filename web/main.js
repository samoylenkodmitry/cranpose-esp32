const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const status = document.getElementById('status');
const log = document.getElementById('log');

const started = performance.now();
let frames = 0;
let image = null;

function seconds() {
  return ((performance.now() - started) / 1000).toFixed(1);
}

function showFrame(pixels, width, height, bpp) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    image = null;
  }
  image ??= context.createImageData(width, height);
  const out = image.data;
  if (bpp === 16) {
    for (let i = 0, o = 0; i < pixels.length; i += 2, o += 4) {
      const value = pixels[i] | (pixels[i + 1] << 8);
      out[o] = ((value >> 11) & 0x1f) * 255 / 31;
      out[o + 1] = ((value >> 5) & 0x3f) * 255 / 63;
      out[o + 2] = (value & 0x1f) * 255 / 31;
      out[o + 3] = 255;
    }
  } else {
    for (let i = 0; i < pixels.length; i += 4) {
      out[i] = pixels[i + 2];
      out[i + 1] = pixels[i + 1];
      out[i + 2] = pixels[i];
      out[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  frames += 1;
  status.textContent = `${frames} frames from the emulated chip, ${seconds()} s since the page loaded`;
}

function print(line) {
  log.textContent += line + '\n';
  log.scrollTop = log.scrollHeight;
}

async function bytes(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  const body = path.endsWith('.gz')
    ? response.body.pipeThrough(new DecompressionStream('gzip'))
    : response.body;
  return new Uint8Array(await new Response(body).arrayBuffer());
}

async function start() {
  if (!window.crossOriginIsolated) {
    status.textContent = 'This browser did not allow the shared memory the emulator needs. Reload the page; if this stays, try a current Chrome, Edge or Firefox.';
    return;
  }
  const [{ default: createQemu }, flash, efuse, rom] = await Promise.all([
    import('./qemu-system-xtensa.js'),
    bytes('flash.bin.gz'),
    bytes('efuse.bin'),
    bytes('esp32s3_rev0_rom.bin'),
  ]);
  status.textContent = `Booting ESP-IDF on the emulated chip (${seconds()} s)…`;
  await createQemu({
    arguments: [
      '-M', 'esp32s3', '-m', '8M', '-L', '/pc-bios',
      '-drive', 'file=/fw/flash.bin,if=mtd,format=raw',
      '-drive', 'file=/fw/efuse.bin,if=none,format=raw,id=efuse',
      '-global', 'driver=nvram.esp32s3.efuse,property=drive,value=efuse',
      '-global', 'driver=timer.esp32s3.timg,property=wdt_disable,value=true',
      '-global', 'driver=ssi_psram,property=is_octal,value=true',
      '-nic', 'none', '-display', 'none', '-monitor', 'none',
      '-chardev', 'file,id=uart0,path=/dev/stdout', '-serial', 'chardev:uart0',
      '-accel', 'tcg,tb-size=256,thread=single',
    ],
    print,
    printErr: print,
    onEspRgbFrame: showFrame,
    mainScriptUrlOrBlob: new URL('./qemu-system-xtensa.js', import.meta.url).href,
    preRun: [(module) => {
      module.FS.mkdir('/fw');
      module.FS.mkdir('/pc-bios');
      module.FS.writeFile('/fw/flash.bin', flash);
      module.FS.writeFile('/fw/efuse.bin', efuse);
      module.FS.writeFile('/pc-bios/esp32s3_rev0_rom.bin', rom);
    }],
  });
}

start().catch((error) => {
  status.textContent = `The emulator stopped: ${error.message}`;
  print(String(error.stack ?? error));
});
