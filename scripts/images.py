#!/usr/bin/env python3
"""Writes the files the emulated ESP32-S3 boots from into a site folder.

flash.bin.gz: the merged 8 MB flash image (bootloader, partition table and
app), gzipped; the page unpacks it. efuse.bin: an eFuse dump of a calibrated
chip of revision v0.3. With ADC calibration version 0, ESP-IDF calibrates the
ADC at boot and waits for an ADC the emulator does not model.
"""

import gzip
import pathlib
import subprocess
import sys


def efuse_image():
    # QEMU keeps the blocks back to back: BLOCK0 takes 24 bytes and BLOCK1 24,
    # so BLOCK2 starts at byte 48. WAFER_VERSION_MINOR_LO is BLOCK1 bits 114-116
    # and BLK_VERSION_MAJOR is BLOCK2 bits 128-129.
    data = bytearray(1024)
    data[24 + 114 // 8] |= 0b011 << (114 % 8)
    data[48 + 128 // 8] |= 0b01 << (128 % 8)
    return bytes(data)


def main():
    firmware = pathlib.Path(sys.argv[1])
    out = pathlib.Path(sys.argv[2])
    elf = firmware / "target/xtensa-esp32s3-espidf/release/cranpose-esp32-demo"
    out.mkdir(parents=True, exist_ok=True)
    flash = out / "flash.bin"
    subprocess.run(
        [
            "espflash", "save-image", "--chip", "esp32s3", "--merge", "--flash-size", "8mb",
            "--bootloader", str(elf.parent / "bootloader.bin"),
            "--partition-table", str(firmware / "partitions.csv"),
            str(elf), str(flash),
        ],
        check=True,
    )
    (out / "flash.bin.gz").write_bytes(gzip.compress(flash.read_bytes(), compresslevel=9))
    flash.unlink()
    (out / "efuse.bin").write_bytes(efuse_image())


if __name__ == "__main__":
    main()
