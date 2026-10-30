import { useEffect } from 'react';
import { Platform } from 'react-native';

import { colors, radius } from '@/design/tokens';

// Diagnose fuer das seitliche Verschieben und die verdeckte Tab-Leiste am
// iPhone (30.10.2026). Beides ist in Chromium und in der WebKit-Emulation von
// Playwright nicht nachzustellen - die kennt die schwebende Leiste von
// Safari 26 nicht. Deshalb misst diese Tafel am echten Geraet und schaltet
// die Kandidaten fuer eine Loesung live um, ohne neuen Deploy.
//
// NUR AUF STAGING und nur mit ?diagnose=1 in der Adresse. Kein React-Native-
// Baum, sondern ein eigenes DOM-Element: die Tafel soll das Layout, das sie
// vermisst, nicht selbst veraendern. Bewusst ohne i18n - ein Werkzeug fuers
// Team, die Beschriftungen sind CSS- und DOM-Begriffe.
//
// Wieder entfernen, sobald die Ursache feststeht.

type Fix = { id: string; label: string; css?: string; apply?: (on: boolean) => void };

const VIEWPORT_DEFAULT = 'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover';

const FIXES: Fix[] = [
  { id: 'A', label: 'overflow-x: hidden auf html, body, #root', css: 'html,body,#root{overflow-x:hidden !important;}' },
  { id: 'B', label: 'overscroll-behavior: none auf html, body', css: 'html,body{overscroll-behavior:none !important;}' },
  { id: 'C', label: 'body position: fixed; inset: 0', css: 'body{position:fixed !important;inset:0 !important;}' },
  { id: 'D', label: 'html overflow: hidden', css: 'html{overflow:hidden !important;}' },
  {
    id: 'E',
    label: 'viewport ohne viewport-fit=cover',
    apply: (on) => {
      const meta = document.querySelector('meta[name="viewport"]');
      meta?.setAttribute('content', on ? 'width=device-width, initial-scale=1' : VIEWPORT_DEFAULT);
    },
  },
];

function describe(el: Element): string {
  const thc = el.getAttribute('data-thc');
  const label = el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 30);
  return `${el.tagName.toLowerCase()}${thc ? `[${thc}]` : ''} "${label}"`;
}

export function ViewportDiagnose() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (process.env.EXPO_PUBLIC_APP_ENV !== 'staging') return;
    if (!new URLSearchParams(window.location.search).has('diagnose')) return;

    const panel = document.createElement('div');
    panel.setAttribute('aria-hidden', 'true');
    panel.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:100%',
      'max-width:100%',
      'box-sizing:border-box',
      'max-height:50%',
      'overflow:auto',
      'z-index:9999',
      'padding:8px',
      'font:11px/1.4 ui-monospace,Menlo,monospace',
      `color:${colors.ink900}`,
      `background:${colors.surface}`,
      `border-bottom:2px solid ${colors.ocean700}`,
      'white-space:pre-wrap',
      'word-break:break-all',
    ].join(';');

    // Sonde fuer die Safe-Area: env() laesst sich nur ueber CSS auslesen.
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top,0) env(safe-area-inset-right,0) env(safe-area-inset-bottom,0) env(safe-area-inset-left,0)';

    const style = document.createElement('style');
    const active = new Set<string>();

    const out = document.createElement('div');
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px';

    const render = () => {
      style.textContent = FIXES.filter((f) => active.has(f.id) && f.css)
        .map((f) => f.css)
        .join('\n');
      const de = document.documentElement;
      const vv = window.visualViewport;
      const cw = de.clientWidth;
      const ps = getComputedStyle(probe);
      const wide = [...document.querySelectorAll('body *')]
        .filter((el) => el !== panel && !panel.contains(el))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.right > cw + 0.5 || r.left < -0.5))
        .sort((a, b) => b.r.right - a.r.right)
        .slice(0, 6)
        .map(({ el, r }) => `  ${Math.round(r.left)}..${Math.round(r.right)} ${describe(el)}`);
      const ios = /OS (\d+[_\d]*)/.exec(navigator.userAgent)?.[1]?.replace(/_/g, '.') ?? '?';

      out.textContent = [
        `iOS ${ios}  standalone=${String((navigator as { standalone?: boolean }).standalone ?? false)}`,
        `innerW/H ${window.innerWidth}x${window.innerHeight}  clientW ${cw}`,
        `scrollW doc ${de.scrollWidth} body ${document.body.scrollWidth}  scrollH doc ${de.scrollHeight}`,
        `window.scroll ${Math.round(window.scrollX)},${Math.round(window.scrollY)}`,
        vv
          ? `visualVP ${Math.round(vv.width)}x${Math.round(vv.height)} off ${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)} page ${Math.round(vv.pageLeft)},${Math.round(vv.pageTop)} scale ${vv.scale.toFixed(3)}`
          : 'visualVP -',
        `safe-area t${ps.paddingTop} r${ps.paddingRight} b${ps.paddingBottom} l${ps.paddingLeft}`,
        `aktiv: ${[...active].join(',') || '-'}`,
        wide.length ? `breiter als ${cw}:\n${wide.join('\n')}` : `nichts breiter als ${cw}`,
      ].join('\n');

      for (const btn of buttons.children) {
        const on = active.has((btn as HTMLElement).dataset.fix ?? '');
        (btn as HTMLElement).style.background = on ? colors.ocean700 : colors.surface;
        (btn as HTMLElement).style.color = on ? colors.surface : colors.ink900;
      }
    };

    for (const fix of FIXES) {
      const btn = document.createElement('button');
      btn.dataset.fix = fix.id;
      btn.textContent = `${fix.id}: ${fix.label}`;
      btn.style.cssText = `font:11px ui-monospace,Menlo,monospace;padding:6px 8px;border:1px solid ${colors.ocean700};border-radius:${radius.sm}px`;
      btn.onclick = () => {
        if (active.has(fix.id)) active.delete(fix.id);
        else active.add(fix.id);
        fix.apply?.(active.has(fix.id));
        // Erst nach dem Umbruch messen, sonst stehen noch die alten Masse da.
        requestAnimationFrame(() => requestAnimationFrame(render));
      };
      buttons.appendChild(btn);
    }

    const toggle = document.createElement('button');
    toggle.textContent = 'Tafel ein/aus';
    toggle.style.cssText = `font:11px ui-monospace,Menlo,monospace;padding:6px 8px;border:1px solid ${colors.line};border-radius:${radius.sm}px`;
    toggle.onclick = () => {
      const hidden = out.style.display === 'none';
      out.style.display = hidden ? '' : 'none';
      buttons.style.display = hidden ? 'flex' : 'none';
    };

    panel.append(toggle, out, buttons);
    document.head.appendChild(style);
    document.body.append(probe, panel);

    const vv = window.visualViewport;
    window.addEventListener('scroll', render, { passive: true });
    window.addEventListener('resize', render);
    vv?.addEventListener('resize', render);
    vv?.addEventListener('scroll', render);
    const timer = window.setTimeout(render, 1500);
    render();

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', render);
      window.removeEventListener('resize', render);
      vv?.removeEventListener('resize', render);
      vv?.removeEventListener('scroll', render);
      panel.remove();
      probe.remove();
      style.remove();
    };
  }, []);

  return null;
}
