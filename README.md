# Cranpose on an emulated ESP32-S3

**[Open the live page](https://samoylenkodmitry.github.io/cranpose-esp32/)**

The page runs the firmware of a [Cranpose](https://github.com/samoylenkodmitry/Cranpose)
app on an ESP32-S3 that the browser emulates. The chip's ROM, ESP-IDF's
bootloader and the app run as they would on a board. Cranpose composes, lays
out and draws every frame on the emulated Xtensa LX7, and the frames reach a
canvas through the emulator's virtual RGB panel. The serial log of the chip
shows below the screen.

## Parts

- `firmware/`: the Rust app. It depends on Cranpose by git, without the
  1.3 MB embedded font: it draws text in an 18 KB Latin subset of Noto Sans
  (`firmware/assets`, SIL Open Font License). It runs through
  [`cranpose-platform-esp-idf`](https://github.com/samoylenkodmitry/Cranpose/tree/main/crates/cranpose-platform/esp-idf),
  which draws each picture on the CPU and sends the changed rows to an ESP-IDF
  LCD panel. On the emulator that panel is QEMU's virtual RGB panel.
- `web/`: the page. It loads the emulator, writes the boot images into its
  file system and draws the panel's frames on a canvas.
  [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) adds the
  cross-origin isolation headers GitHub Pages does not send; the emulator needs
  them for its threads' shared memory.
- `scripts/images.py`: writes the merged flash image and an eFuse dump of a
  calibrated chip.
- The emulator is [cranpose-esp32-qemu](https://github.com/samoylenkodmitry/cranpose-esp32-qemu):
  Espressif's QEMU with its ESP32-S3 board on [qemu-wasm](https://github.com/ktock/qemu-wasm),
  which compiles hot guest code to WebAssembly while it runs. Its releases
  carry the WebAssembly build.

## Limits

The emulator follows the chip's instructions, not its timing. Booting takes
several seconds and the demo draws about 13 frames a second in desktop Chrome;
neither number says anything about a board. The page needs a browser with WebAssembly threads:
current Chrome, Edge and Firefox on a desktop.

## Build

```sh
espup install --name esp-1.98.1 --toolchain-version 1.98.1.0 --targets esp32s3 --std
cargo install --locked ldproxy espflash
. ~/export-esp.sh
cd firmware && cargo build --release && cd ..
python3 scripts/images.py firmware dist
```

Then put the files of an emulator release and `web/` into `dist/` and serve it
over HTTPS or from localhost. A `v*` tag builds and publishes the page through
`.github/workflows/pages.yml`.

## License

The firmware, the page and the scripts are available under the Apache License
2.0 or the MIT license, at your option. The emulator is QEMU and is under the
GNU GPL version 2; its source is
[cranpose-esp32-qemu](https://github.com/samoylenkodmitry/cranpose-esp32-qemu).
coi-serviceworker is under the MIT license.
