"""Публикационная сборка анимированного сайта.

Источник — рабочий прототип experiments/motion-prototype (не меняется)
плюс общие css/style.css, js/main.js и images/ основного сайта (тоже не
меняются). Результат — самостоятельная папка release/animated-site:
ссылки ../../ переписаны, в сборку попадают только файлы, на которые
есть ссылки из HTML и CSS. Резервные копии, скриншоты, инструменты,
отчёты и неиспользуемые изображения не копируются.

Только для публикации:
  - убран <meta name="robots" content="noindex">;
  - заголовок вкладки без «· прототип анимации»;
  - убрана служебная метка режима анимации (.proto-badge).

Запуск из корня проекта:
  python release/build-animated-site.py
"""
import os
import re
import shutil
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
PROTO = os.path.join(ROOT, 'experiments', 'motion-prototype')
OUT = os.path.join(ROOT, 'release', 'animated-site')

copied = set()
missing = []


def copy(src, dst_rel):
    dst = os.path.join(OUT, dst_rel)
    if dst_rel in copied:
        return
    if not os.path.isfile(src):
        missing.append(src)
        return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    copied.add(dst_rel)


def css_urls(text):
    return [u.strip('\'"') for u in re.findall(r'url\(([^)]+)\)', text)
            if not u.strip('\'"').startswith(('data:', 'http'))]


if os.path.exists(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)

# ---- index.html --------------------------------------------------------------
html = open(os.path.join(PROTO, 'index.html'), encoding='utf-8').read()
html = html.replace('../../', '')
n_robots = len(re.findall(r'\s*<meta name="robots" content="noindex">', html))
html = re.sub(r'\s*<meta name="robots" content="noindex">', '', html)
html = html.replace('<title>Юлия Седышева — контент-стратег · прототип анимации</title>',
                    '<title>Юлия Седышева — смыслы, визуал, сайты</title>')
html = re.sub(r'\s*<!-- Метка прототипа[^>]*-->\s*<div class="proto-badge" aria-hidden="true"></div>', '', html)
assert n_robots == 1 and 'proto-badge' not in html and 'прототип анимации' not in html.split('</title>')[0]
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)

# Ресурсы из HTML
for attr in re.findall(r'(?:src|href)="([^"#:][^"]*)"', html):
    if attr.startswith(('http', 'mailto', 'tel')):
        continue
    if attr.startswith(('css/', 'js/', 'images/')):
        copy(os.path.join(ROOT, attr), attr)
    else:
        copy(os.path.join(PROTO, attr), attr)

# Ресурсы из CSS (пути — относительно самого CSS-файла)
for rel in [c for c in list(copied) if c.endswith('.css')]:
    base = os.path.dirname(rel)
    srcdir = os.path.join(ROOT, base) if rel.startswith('css/') else os.path.join(PROTO, base)
    for u in css_urls(open(os.path.join(OUT, rel), encoding='utf-8').read()):
        target = os.path.normpath(os.path.join(base, u)).replace('\\', '/')
        copy(os.path.normpath(os.path.join(srcdir, u)), target)

# motion.js берёт глаз крупным планом по ссылке из fragments.css — уже
# скопирован; других путей в JS нет.

# Кэш картинок на Netlify (как в корневом netlify.toml)
open(os.path.join(OUT, 'netlify.toml'), 'w', encoding='utf-8').write(
    '# Публикационная сборка анимированного сайта. Статика, без сборки.\n'
    '[build]\n  publish = "."\n  command = ""\n\n'
    '[[headers]]\n  for = "/images/*"\n  [headers.values]\n    Cache-Control = "public, max-age=604800"\n\n'
    '[[headers]]\n  for = "/fragments/*"\n  [headers.values]\n    Cache-Control = "public, max-age=604800"\n')

size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
print(f'файлов: {len(copied) + 2}, размер: {size / 1024 / 1024:.2f} МБ')
if missing:
    print('НЕ НАЙДЕНЫ:', *missing, sep='\n  ')
    sys.exit(1)
