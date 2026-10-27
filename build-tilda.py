#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка одного самодостаточного HTML-блока для Tilda.

  python3 build-tilda.py

На выходе: tilda/abmarine-hero.tilda.html
  • CSS полностью изолирован под #abmHero (не конфликтует со стилями Tilda)
  • JS в IIFE с защитой от повторной инициализации
  • единственный внешний файл — CGI-кадр судна, его адрес подставляется вручную
    (фон — градиент + вшитая миниатюра, отдельных файлов нет)
Вставляется в блок «T123 · HTML-код» или в HTML-элемент Zero Block.
"""
import re, os, pathlib

ROOT = pathlib.Path(__file__).parent
SCOPE = '#abmHero'


# ─────────────────── изоляция CSS ───────────────────
def scope_selector(sel: str) -> str:
    out = []
    for part in sel.split(','):
        p = part.strip()
        if not p:
            continue
        if p.startswith(SCOPE):
            out.append(p)
        elif p == '*' or p.startswith('*::'):
            suffix = p[1:]                       # '' | '::before' | '::after'
            out.append('%s%s' % (SCOPE, suffix))
            out.append('%s *%s' % (SCOPE, suffix))
        elif p in ('body', 'html', ':root'):
            out.append(SCOPE)
        elif p.startswith('::') or p.startswith(':'):
            out.append('%s %s' % (SCOPE, p))
        else:
            out.append('%s %s' % (SCOPE, p))
    return ',\n'.join(out)


def strip_comments(css: str) -> str:
    """Комментарии убираются до разбора — иначе `,` внутри них ломает селекторы."""
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def scope_css(css: str) -> str:
    res, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j == -1:
            res.append(css[i:])
            break
        prelude = css[i:j]
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        lead_len = len(prelude) - len(prelude.lstrip())
        lead, sel = prelude[:lead_len], prelude.strip()

        if sel.startswith('@'):
            at = sel.split('{')[0].split()[0].lower()
            inner = scope_css(body) if at in ('@media', '@supports') else body
            res.append(lead + sel + '{' + inner + '}')
        else:
            res.append(lead + scope_selector(sel) + '{' + body + '}')
        i = k
    return ''.join(res)


# ─────────────────── сборка ───────────────────
def build():
    css = (ROOT / 'assets/css/hero.css').read_text(encoding='utf-8')
    js = (ROOT / 'assets/js/hero.js').read_text(encoding='utf-8')
    html = (ROOT / 'index.html').read_text(encoding='utf-8')

    markup = html.split('<!--ABM:START-->')[1].split('<!--ABM:END-->')[0].strip()
    markup = markup.replace('src="assets/ship/hero-vessel.webp"', 'src="' + PLATE + '"')
    # в Tilda используется собственный блок меню — свой header не вставляем
    markup = re.sub(r'<!--ABM:HDR-->.*?<!--/ABM:HDR-->', HDR_NOTE, markup, flags=re.S)

    scoped = scope_css(strip_comments(css))
    scoped = re.sub(r'\n{3,}', '\n\n', scoped)
    # корневой контейнер: полная ширина внутри любого контейнера Tilda
    scoped = (
        '/* ─── НАСТРОЙКИ БЛОКА ───────────────────────────────────────────\n'
        '   --menu-h : высота меню Tilda, если оно ЗАКРЕПЛЕНО и занимает\n'
        '              место в потоке — экран станет ровно на остаток окна.\n'
        '   --hdr-h  : верхний отступ контента. Если меню Tilda «поверх»\n'
        '              (fixed), поставьте сюда его высоту.\n'
        '   --brand  : фирменный синий. Остальные токены — ниже.           */\n'
        '#abmHero{\n'
        '  position:relative;display:block;width:100%;isolation:isolate;\n'
        '  text-align:left;line-height:normal;\n'
        '}\n' + scoped
    )
    # в Tilda своя шапка → внутренний отступ меньше, плюс переменная под её высоту
    scoped = scoped.replace(
        '  --hdr-h:84px;',
        '  --menu-h:0px;   /* высота меню Tilda, если оно в потоке страницы */\n'
        '  --hdr-h:28px;   /* верхний отступ; если меню Tilda fixed — его высота */',
        1)

    js_wrapped = re.sub(r"^\(function \(\) \{\n  'use strict';",
                        "(function () {\n  'use strict';\n"
                        "  if (window.__abmHeroReady) return;\n"
                        "  window.__abmHeroReady = true;", js, count=1)

    out = TEMPLATE.format(css=scoped, markup=markup, js=js_wrapped)
    dst = ROOT / 'tilda'
    dst.mkdir(exist_ok=True)
    (dst / 'abmarine-hero.tilda.html').write_text(out, encoding='utf-8')
    print('tilda/abmarine-hero.tilda.html  —  %.1f KB' % (len(out.encode()) / 1024))

    # Сам блок — фрагмент без <head>: открытый напрямую в браузере он
    # остаётся без charset (кириллица превращается в «РЎСѓРґРЅРѕ») и без
    # картинки (вместо адреса — плейсхолдер). Для просмотра кладём рядом
    # полноценную страницу с тем же содержимым.
    preview = PREVIEW.format(
        body=out.replace(PLATE, '../assets/ship/hero-vessel.webp'))
    (dst / 'preview.html').write_text(preview, encoding='utf-8')
    print('tilda/preview.html             —  открывается напрямую, для проверки')


PLATE = 'ЗАМЕНИТЕ_НА_АДРЕС_КАРТИНКИ_В_TILDA'

PREVIEW = '''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>AB Marine — первый экран (просмотр Tilda-сборки)</title>
<style>html,body{{margin:0;padding:0;background:#fff}}</style>
</head>
<body>
{body}
</body>
</html>
'''

HDR_NOTE = ('  <!-- Шапка не входит в блок: используйте штатное меню Tilda (ME301 / МЕ601).\n'
            '       Высота меню задаётся переменной --menu-h в блоке настроек выше. -->')

TEMPLATE = '''<!-- ══════════════════════════════════════════════════════════════
     AB MARINE · первый экран
     Вставка: Tilda → блок «T123 · HTML-код» (на всю ширину)
              либо Zero Block → элемент HTML (100% ширины и высоты).
     Все стили изолированы внутри #abmHero — глобальные стили Tilda не задеты.
     Единственный внешний файл — кадр судна в разрезе, 318 КБ (см. ШАГ 1).
     Новый рендер меняется без правок вёрстки: координаты хотспотов, узлов
     и трасс заданы в системе кадра 1157 × 748 (массивы CHIPS / NODES / ROUTES).
     ══════════════════════════════════════════════════════════════ -->

<!-- ШАГ 1. Загрузите assets/ship/hero-vessel.webp в Tilda («Изображения» или Файловый
     менеджер), скопируйте адрес вида https://static.tildacdn.com/.../hero-vessel.webp
     и замените им строку ЗАМЕНИТЕ_НА_АДРЕС_КАРТИНКИ_В_TILDA ниже (одно вхождение).
     ШАГ 2. В блоке #abmHero задайте --menu-h и --hdr-h под своё меню.
     ШАГ 3. Ссылки #catalog / #about / #formblock замените на ID блоков Tilda. -->

<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Raleway:wght@200;300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">

<style>
{css}
</style>

{markup}

<script>
{js}
</script>
'''

if __name__ == '__main__':
    build()
