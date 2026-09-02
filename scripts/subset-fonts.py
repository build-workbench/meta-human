#!/usr/bin/env python3
"""中文字体切片再生成脚本（Google Fonts 式 unicode-range 按需加载）。

用法：python3 scripts/subset-fonts.py   （需 python3 + fonttools + brotli）

背景：public/fonts 下 Resource Han Rounded CN 原为全量 woff2（Regular/Bold 各
~600K，GB2312 一级字库 3782 字）。字体本身已是最小常用集，按字符集子集化无收益；
改为切片：片 0 = 源码 UI 实际用字（含全角标点），片 1+ = 其余字按码点 450 字/片，
配合 index.css 的 unicode-range 声明，浏览器只下载页面实际用到的片。

实测（2026-09-02）：落地页 + /app 的 UI 仅需片 0（Regular+Bold 共 ~290K + mono 15K），
对比原全量 1188K 下载量 -74%；聊天内容遇到生僻字时浏览器自动拉对应片，
字形全集保留、永不 fallback。

⚠️ 片 0 的字符集来自 src/**/*.{ts,tsx} 与 index.html 扫描 —— 新增 UI 文案含新字时
必须重跑本脚本，否则新字将 fallback 到系统字体（视觉混排）。

全量源字体保留在 scripts/fonts/（构建输入，不参与部署）。
"""

import glob
import subprocess
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "public" / "fonts"
CHUNK = 450

SRC_FONTS = Path(__file__).resolve().parent / "fonts"
FULL_REG = SRC_FONTS / "han-rounded.woff2"
FULL_BOLD = SRC_FONTS / "han-rounded-bold.woff2"


def ranges_of(cps: list[int]) -> str:
    spans: list[tuple[int, int]] = []
    start = prev = cps[0]
    for cp in cps[1:]:
        if cp == prev + 1:
            prev = cp
            continue
        spans.append((start, prev))
        start = prev = cp
    spans.append((start, prev))
    return ",".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in spans)


def main() -> int:
    if not FULL_REG.exists() or not FULL_BOLD.exists():
        print(f"错误：缺少全量字体 {FULL_REG.name} / {FULL_BOLD.name}。")
        print("请先恢复全量字体到 public/fonts/ 再运行（见脚本头注释）。")
        return 1

    cmap = set(TTFont(FULL_REG).getBestCmap().keys())

    # UI 字符集 = 源码中所有「字体有字形」的非 ASCII 字符（含全角标点/破折号/书名号）
    ui_cps: set[int] = set()
    for pattern in ("src/**/*.ts", "src/**/*.tsx", "index.html"):
        for f in glob.glob(str(ROOT / pattern), recursive=True):
            try:
                for c in Path(f).read_text(encoding="utf-8", errors="ignore"):
                    cp = ord(c)
                    if cp >= 0x80 and cp in cmap:
                        ui_cps.add(cp)
            except OSError:
                pass
    ui_sorted = sorted(ui_cps)
    rest = sorted(c for c in cmap if c not in ui_cps)
    print(f"UI 用字（有字形）: {len(ui_sorted)}；其余: {len(rest)}；合计 {len(ui_sorted) + len(rest)}")

    groups = [ui_sorted] + [rest[i : i + CHUNK] for i in range(0, len(rest), CHUNK)]
    print(f"共 {len(groups)} 片（片0=UI 全字符，其余 {CHUNK} 字/片）")

    css: list[str] = []
    for weight, full, slug in ((400, FULL_REG, "han-rounded-cn"), (700, FULL_BOLD, "han-rounded-cn-bold")):
        for idx, part in enumerate(groups):
            text_file = FONTS / ".subset-text.tmp"
            text_file.write_text("".join(chr(c) for c in part), encoding="utf-8")
            out = FONTS / f"{slug}-{idx}.woff2"
            subprocess.run(
                [
                    sys.executable, "-m", "fontTools.subset", str(full),
                    f"--text-file={text_file}",
                    "--flavor=woff2",
                    f"--output-file={out}",
                    "--layout-features=*",
                    "--no-hinting",
                    "--desubroutinize",
                ],
                check=True,
            )
            text_file.unlink()
            css.append(
                "@font-face {\n"
                "  font-family: 'Resource Han Rounded CN';\n"
                f"  src: url('/fonts/{out.name}') format('woff2');\n"
                f"  font-weight: {weight};\n"
                "  font-style: normal;\n"
                "  font-display: swap;\n"
                f"  unicode-range: {ranges_of(part)};\n"
                "}"
            )
            print(f"  {out.name}: {out.stat().st_size / 1024:.0f}K ({len(part)}字)")

    css.append(
        "@font-face {\n"
        "  font-family: 'Code New Roman';\n"
        "  src: url('/fonts/code-new-roman.woff2') format('woff2');\n"
        "  font-weight: 400;\n"
        "  font-style: normal;\n"
        "  font-display: swap;\n"
        "}"
    )

    print(f"\nCSS 共 {len(css)} 个 @font-face —— 请将以上 @font-face 段同步到 src/index.css"
          "（脚本不直接改 index.css，避免覆盖手写内容）。")
    (FONTS / "font-faces.generated.css").write_text("\n".join(css) + "\n", encoding="utf-8")
    print(f"已写入 {FONTS / 'font-faces.generated.css'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
