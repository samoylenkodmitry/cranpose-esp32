#!/usr/bin/env python3
"""Build the nightly layouts for QEMU's 320 by 480 panel and capture each screen."""

import argparse
import gzip
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def build(source, output):
    app = source / "apps/esp32-demo"
    target = app / "target"
    elf = target / "xtensa-esp32s3-espidf/release/esp32-demo"
    runner = source / "scripts/esp32/qemu_run.py"
    output.mkdir(parents=True, exist_ok=True)
    for layout, features in (("demo", []), ("dashboard", ["--features", "dashboard"])):
        subprocess.run(["cargo", "build", "--release", "--locked", *features], cwd=app, check=True,
                       env={**os.environ, "CARGO_TARGET_DIR": str(target), "CARGO_WORKSPACE_DIR": str(app)})
        with tempfile.TemporaryDirectory() as temporary:
            image = Path(temporary) / "flash.bin"
            subprocess.run(["espflash", "save-image", "--chip", "esp32s3", "--merge", "--flash-size", "8mb",
                            "--bootloader", str(elf.parent / "build/bootloader.bin"),
                            "--partition-table", str(app / "partitions.csv"), str(elf), str(image)], check=True)
            with gzip.GzipFile(output / f"{layout}.bin.gz", "wb", mtime=0) as compressed:
                compressed.write(image.read_bytes())
            subprocess.run([sys.executable, str(runner), "--elf", str(elf), "--flash-image", str(image),
                            "--until", "frames in", "--timeout", "120",
                            "--screenshot", str(output / f"{layout}.png")], check=True)
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source, text=True).strip()
    (output / "revision.txt").write_text(revision + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Cranpose benchmark checkout")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.source.resolve(), args.output.resolve())
