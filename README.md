# Cranpose on ESP32

**[Open the live page](https://samoylenkodmitry.github.io/cranpose-esp32/)**

This repository is the template from which to start a
[Cranpose](https://github.com/samoylenkodmitry/Cranpose) app for an ESP32 or
ESP32-S3 with a display. Its firmware runs on two boards and on an ESP32-S3
that the browser emulates: the live page boots it on Espressif's QEMU compiled
to WebAssembly.

## Start an app

1. Choose **Use this template** on GitHub, or clone the repository.
2. Install the Xtensa Rust toolchain, `ldproxy` and `espflash`:

   ```sh
   cargo install --locked espup ldproxy espflash
   espup install --name esp-1.98.1 --toolchain-version 1.98.1.0 --targets esp32,esp32s3 --std
   . ~/export-esp.sh
   ```

   The first build downloads ESP-IDF 5.5 into `~/.espressif`.
3. Build the firmware for your board and flash it, from `firmware/`:

   | Board | Build | Flash and show the log |
   | --- | --- | --- |
   | Hosyond ES3C35P (ESP32-S3) | `ESP_IDF_SDKCONFIG_DEFAULTS="sdkconfig.defaults;sdkconfig.es3c35p" cargo build --release --features es3c35p` | `espflash flash --monitor --flash-mode dio --flash-freq 80mhz --bootloader target/xtensa-esp32s3-espidf/release/bootloader.bin --partition-table partitions.csv target/xtensa-esp32s3-espidf/release/cranpose-esp32-demo` |
   | LCDWiki E32R35T, the 3.5-inch ESP32-32E (ESP32) | `ESP_IDF_SDKCONFIG_DEFAULTS="sdkconfig.defaults;sdkconfig.e32r35t" MCU=esp32 cargo build --release --target xtensa-esp32-espidf --features e32r35t` | `espflash flash --monitor --flash-mode dio --flash-freq 80mhz --bootloader target/xtensa-esp32-espidf/release/bootloader.bin --partition-table partitions_4mb.csv target/xtensa-esp32-espidf/release/cranpose-esp32-demo` |
   | QEMU's virtual panel (ESP32-S3) | `cargo build --release` | see [The emulator page](#the-emulator-page) |

   Flash the bootloader that the build made: it turns the flash's quad
   mode on, which espflash's own bootloader does not. The image header stays
   DIO, as ESP-IDF writes it for a QIO app.
4. Write the UI in [`firmware/src/main.rs`](firmware/src/main.rs). It is a
   Cranpose composition like on any other platform: the same composables,
   modifiers, state and animations. An animation that only changes how
   something is drawn reads its value in a draw modifier, as the bar does in
   `draw_behind`: its frames then draw again without composing or laying out
   the screen. A number that changes every frame, as a clock or a sensor
   reading does, draws the same way with `DrawScope::draw_text_from`: on the
   ES3C35P such a frame takes 2.2 ms drawn, 4.7 ms composed in a `Text`.

The log prints the frame times, the internal RAM the heap has left and the
main task's stack every 5 seconds: `300 frames in 5.0 s: update 0.18 ms, draw
and send 0.26 ms, slowest 5.7 ms; heap 103 KB free, 52 KB in one block, 71 KB
at least; stack 10760 bytes never used` on the ES3C35P, `300 frames in 5.0 s:
update 0.82 ms, draw and send 0.50 ms, slowest 7.8 ms; heap 144 KB free, 116
KB in one block, 143 KB at least; stack 11072 bytes never used` on the
E32R35T. One block is the longest allocation that can succeed; at least is
the least that was free since startup. The stack the app never used is what
`CONFIG_ESP_MAIN_TASK_STACK_SIZE` could give back to the heap; keep a few KB
of it for screens the run did not show.

## Boards

| Feature | Board | Chip | Display | Touch |
| --- | --- | --- | --- | --- |
| `es3c35p` | Hosyond ES3C35P | ESP32-S3 N16R8: 16 MB flash, 8 MB octal PSRAM | 320 by 480 ST77922 on quad SPI | capacitive, built into the display controller, I2C address 0x55 |
| `e32r35t` | LCDWiki E32R35T | ESP32-D0WD-V3: 4 MB flash, no PSRAM | 320 by 480 ST7796 on SPI | resistive XPT2046 on the display's bus |
| none | QEMU's virtual panel | emulated ESP32-S3 with PSRAM | 320 by 240 RGB | none |

Each board is a module in [`firmware/src/board`](firmware/src/board). It opens
the display and the touch panel with the drivers of
[`cranpose-platform-esp-idf`](https://github.com/samoylenkodmitry/Cranpose/tree/main/crates/cranpose-platform/esp-idf)
and gives the display settings that suit its chip.

### Another board

A board whose display controller takes MIPI DCS commands on SPI or quad SPI,
such as the ST7789, ST7796, ILI9341 or ST77922, needs no change outside
`firmware/`:

1. Copy [`e32r35t.rs`](firmware/src/board/e32r35t.rs) (SPI) or
   [`es3c35p.rs`](firmware/src/board/es3c35p.rs) (quad SPI) to a new module,
   add a cargo feature for it in `firmware/Cargo.toml` and select it in
   [`board.rs`](firmware/src/board.rs).
2. Set the pins from the board's schematic: the SPI bus and its clock, the
   chip select, the data/command line, the reset line if the display has
   one, and the backlight with the level that turns it on.
3. Take the controller's start-up sequence from the board vendor's example
   code: sleep out, colour mode (`0x3A`, 16-bit), scan direction (`0x36`),
   the glass's voltages and gamma, display on. Set the size, the offset of
   the visible area in the controller's memory, and the alignment of update
   windows if the controller needs one.
4. Set the touch panel: `Xpt2046Touch` with a calibration, or
   `St77922Touch`, with an `Orientation` if the glass is mounted turned.
5. Set `strip_rows`: a strip takes 10 bytes of internal memory a pixel.
6. Add an sdkconfig file for the board, as `sdkconfig.es3c35p` and
   `sdkconfig.e32r35t` do: its flash size, QIO mode if its flash module has
   the four data lines wired (most do).

## Settings files

- `firmware/sdkconfig.defaults`: the ESP-IDF settings of every chip. The UI
  runs on the main task, whose 28 KB stack holds composition and layout, and
  the bootloader starts the app without checking its whole image first, which
  takes half a second on these boards.
- `firmware/sdkconfig.defaults.esp32s3` and `.esp32`: ESP-IDF adds the one of
  the chip it builds for. The S3 file expects 8 MB of octal PSRAM (N8R8,
  N16R8; a module with quad PSRAM needs `CONFIG_SPIRAM_MODE_QUAD=y`) and sets
  the largest caches. The classic file sets one core, which saves the second
  core's 20 KB of tasks.
- `firmware/sdkconfig.es3c35p` and `sdkconfig.e32r35t`: each board's console,
  flash size and flash in QIO mode at 80 MHz. A frame waits for its code
  mostly: QIO mode and the S3's larger caches cut the frame of an earlier
  version of this app, which composed and laid out its bar every frame, from
  10.2 to 5.7 ms on the ES3C35P and from 20.4 to 6.4 ms on the E32R35T.
- `firmware/partitions.csv` and `partitions_4mb.csv`: the flash layouts for 8
  and 4 MB of flash.
- `firmware/Cargo.toml`: the release profile (`opt-level = 2`, fat LTO, one
  codegen unit) runs a frame in about a quarter fewer instructions than
  `opt-level = "s"`.

Cranpose itself links the framework code a frame runs most into IRAM, where
the CPU fetches it without the cache: 125 KB on the ESP32-S3 and 64 KB on the
classic ESP32, for a frame of this app of 0.44 and 1.32 ms. `CONFIG_CRANPOSE_HOT_CODE_IN_IRAM=n`
in an sdkconfig file turns it off for an app that needs the memory more.

### Another Cranpose revision

Change the `rev` of the four Cranpose dependencies in `firmware/Cargo.toml`.
ESP-IDF keeps the components it built first, Cranpose's IRAM function list
and C code among them: the build stops when it finds them and names the
command that builds them again, `cargo clean -p esp-idf-sys --release
--target <the board's target>`.

## The emulator page

The page runs the firmware of the QEMU build on an ESP32-S3 that the browser
emulates. The chip's ROM, ESP-IDF's bootloader and the app run as they would
on a board. Cranpose composes, lays out and draws every frame on the emulated
Xtensa LX7, and the frames reach a canvas through the emulator's virtual RGB
panel. The serial log of the chip shows below the screen.

- `firmware/`: the Rust app. It depends on Cranpose by git, without the
  1.3 MB embedded font: it draws text in an 18 KB Latin subset of Noto Sans
  (`firmware/assets`, SIL Open Font License).
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

The emulator follows the chip's instructions, not its timing. Booting takes
several seconds and the app draws about 13 frames a second in desktop Chrome;
neither number says anything about a board. The page needs a browser with
WebAssembly threads: current Chrome, Edge and Firefox on a desktop.

Build the page's files:

```sh
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
