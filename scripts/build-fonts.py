#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字体子集化：把三款开源中文字体裁成本站实际用到的字形，输出 WOFF2。

为什么需要它
    正文字体若走 Google Fonts，手机端常常加载不到，就会退回系统字体；
    而宋体、楷体只存在于苹果系统，安卓上会整站掉成黑体。自托管才能让
    所有人看到同一套字，但中文全字库有三万余字，必须裁剪后才可入库。

改过文案之后请重跑本脚本，否则新增的生僻字会缺字形、掉回系统字体。
    python3 scripts/build-fonts.py

依赖
    pip install fonttools brotli      # 需要 brotli 才能输出 woff2
    原始字体放在 .fontsrc/（已 gitignore，不入库）
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".fontsrc"
OUT = ROOT / "assets" / "fonts"

# 扫描这些文件里出现的每一个字，作为「全站字符集」
CONTENT_GLOBS = ["index.html", "detail.html", "assets/data/*.js",
                 "assets/js/*.js", "assets/css/styles.css"]

# 三款字体的来源、输出名与用途
FONTS = [
    {
        "src": "NotoSerifSC-VF.ttf",
        "out": "NotoSerifSC-subset.woff2",
        "scope": "full",          # 正文与标题，也是所有字体的最终兜底，必须全覆盖
        "wght": "400:700",        # 可变字重轴裁到实际用到的区间
    },
    {
        "src": "LXGWWenKai-Regular.ttf",
        "out": "LXGWWenKai-subset.woff2",
        "scope": "full",          # 题跋、引文；同时是手写体的兜底
        "wght": None,
    },
    {
        "src": "MaShanZheng-Regular.ttf",
        "out": "MaShanZheng-subset.woff2",
        "scope": "hand",          # 仅序诗、四季序号、舆地小标题三处，单独裁小
        "wght": None,
    },
]

# --hand 手写体只作用于这三类元素（见 styles.css 的 .verse / .season__ord / .geo__col h4）
HAND_PATTERNS = [
    r'<[^>]*class="[^"]*\bverse\b[^"]*"[^>]*>(.*?)</(?:div|blockquote|section)>',
    r'<[^>]*class="[^"]*\bseason__ord\b[^"]*"[^>]*>(.*?)</span>',
    r'<[^>]*class="[^"]*\bgeo__col\b[^"]*"[^>]*>\s*<h4[^>]*>(.*?)</h4>',
]

CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")


def strip_tags(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html)


def collect_full_charset() -> set:
    """全站出现过的中文字、全角标点，加上完整 ASCII 可见字符。"""
    text = []
    for pattern in CONTENT_GLOBS:
        for path in sorted(ROOT.glob(pattern)):
            text.append(path.read_text(encoding="utf-8"))
    blob = "".join(text)

    chars = {c for c in blob if CJK.match(c)}
    # 全角标点、书名号「」『』、破折号等
    chars |= {c for c in blob
              if "\u3000" <= c <= "\u303f" or "\uff00" <= c <= "\uffef"}
    # CSS content 里的箭头、间隔号一类符号
    chars |= {c for c in blob if c in "→←↑↓·—–…×％°"}
    # ASCII 可见字符与空格，供年份、数字、拉丁文使用
    chars |= {chr(i) for i in range(0x20, 0x7f)}
    return chars


def collect_hand_charset() -> tuple:
    """手写体三处用字。缺字会退到楷体，同属中文，不会出现豆腐块。

    返回（页面实际用到的字符，实际裁剪进字体的字符）。两者分开是为了让
    缺字提示只针对真会显示出来的字，不被保险集里的备用字淹没。
    """
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    found = []
    for pattern in HAND_PATTERNS:
        for block in re.findall(pattern, html, flags=re.S):
            found.append(strip_tags(block))
    text = "".join(found)

    # 取这三处出现的全部字符，而非只取汉字——序诗里的破折号、间隔号、
    # 全角逗号若缺失，会掉回楷体，同一句诗里就混了两款字。
    used = {c for c in text if not c.isspace()}

    # 兜一层保险：天干序号、四季，以及中文标点与常用符号
    spare = set("壹貳參叄肆伍陸陆柒捌玖拾春夏秋冬序卷")
    spare |= set("，。、；：？！「」『』（）《》〈〉—…·〇“”‘’")
    spare |= {chr(i) for i in range(0x20, 0x7f)}
    return used, used | spare


def subset(font: dict, charset: set) -> None:
    src = SRC / font["src"]
    if not src.exists():
        sys.exit(f"缺少原始字体 {src}，请先下载到 .fontsrc/")

    work = src
    tmp = None
    if font["wght"]:
        tmp = SRC / f"_range_{font['src']}"
        subprocess.run(
            [sys.executable, "-m", "fontTools.varLib.instancer",
             str(src), f"wght={font['wght']}", "-o", str(tmp)],
            check=True, stdout=subprocess.DEVNULL,
        )
        work = tmp

    text = "".join(sorted(charset))
    dest = OUT / font["out"]
    subprocess.run(
        ["pyftsubset", str(work),
         f"--text={text}",
         "--flavor=woff2",
         "--layout-features=*",       # 保留 kern、CJK 标点压缩等特性
         "--name-IDs=*",
         "--drop-tables+=DSIG",
         f"--output-file={dest}"],
        check=True,
    )
    if tmp and tmp.exists():
        tmp.unlink()

    kb = dest.stat().st_size / 1024
    print(f"  {font['out']:<28} {len(charset):>5} 字形  {kb:>7.1f} KB")


def verify(charset: set) -> None:
    """确认正文字体真的覆盖了全站每一个字，缺字直接报错而不是静默降级。"""
    from fontTools.ttLib import TTFont

    f = TTFont(OUT / "NotoSerifSC-subset.woff2")
    have = set()
    for table in f["cmap"].tables:
        have |= {chr(cp) for cp in table.cmap}
    missing = {c for c in charset if c not in have and c.strip()}
    if missing:
        sys.exit("正文字体缺字：" + "".join(sorted(missing)))
    print(f"  校验通过：正文字体覆盖全站 {len(charset)} 个字形，无缺字")


def report_hand_gaps(hand: set) -> None:
    """手写体缺字只提示不报错。

    Ma Shan Zheng 是书法字体，字符集本就不全——它连一个间隔号字形都没有，
    裁剪也补不出来，这类字符只能降级到楷体。这里列出来，免得日后重查。
    """
    from fontTools.ttLib import TTFont

    f = TTFont(OUT / "MaShanZheng-subset.woff2")
    have = set()
    for table in f["cmap"].tables:
        have |= {chr(cp) for cp in table.cmap}
    gaps = sorted(c for c in hand if c not in have and c.strip() and not c.isascii())
    if gaps:
        print("  手写体原字体本身无此字形，将降级到楷体："
              + " ".join(f"{c}(U+{ord(c):04X})" for c in gaps))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    full = collect_full_charset()
    hand_used, hand_all = collect_hand_charset()

    print(f"全站字符集 {len(full)} 个，其中汉字 "
          f"{sum(1 for c in full if CJK.match(c))} 个")
    print(f"手写体字符集 {len(hand_all)} 个，页面实际用到 {len(hand_used)} 个："
          f"{''.join(sorted(c for c in hand_used if CJK.match(c)))}")
    print("裁剪结果：")

    for font in FONTS:
        subset(font, full if font["scope"] == "full" else hand_all)

    verify(full)
    report_hand_gaps(hand_used)
    total = sum((OUT / f["out"]).stat().st_size for f in FONTS) / 1024
    print(f"字体合计 {total:.1f} KB")


if __name__ == "__main__":
    main()
