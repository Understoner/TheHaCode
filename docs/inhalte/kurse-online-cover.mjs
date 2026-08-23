// ---------------------------------------------------------------------------
// Titelbilder fuer die Reihe DER ATEMCODE - ONLINE
// ---------------------------------------------------------------------------
//   node docs/inhalte/kurse-online-cover.mjs <zielordner>
//
// Erzeugt vier PNG mit 1200x675 (16:9, das Seitenverhaeltnis der Kurskachel).
// Danach in Studio -> Storage -> public-assets -> Ordner "courses" hochladen;
// die Dateinamen sind dieselben, die kurse-online-2026.sql eintraegt.
//
// WARUM GERENDERT UND NICHT GEZEICHNET: es sind abstrakte Formen aus den
// Tokens in src/design/tokens.ts - keine Fotos, keine fremden Bildrechte, und
// jederzeit reproduzierbar. Wer echte Fotos hat, ersetzt sie einfach; die
// Datenbank verweist nur auf den Pfad.
//
// WARUM PNG UND NICHT SVG: Migration 0004 laesst im Bucket nur image/png,
// image/jpeg und image/webp zu. Ein SVG-Upload wird abgewiesen. Chromium
// rendert deshalb das SVG zu PNG.
//
// WARUM KEIN BALKENDIAGRAMM BEI "ENERGY": der erste Entwurf war eine nach
// rechts ansteigende Balkenreihe - die las sich wie eine Umsatzgrafik. Jetzt
// ist es ein beidseitiges Atemmuster um die Mittellinie.
// ---------------------------------------------------------------------------

import pw from '@playwright/test';
const { chromium } = pw;
import fs from 'node:fs';

const C = { bg:'#EFF3F4', oceanImageBg:'#DCE8F0', oceanTint:'#F0F6F9', sageTint:'#F2F6F1',
            ocean500:'#5B93AC', ocean700:'#3B6C82', ocean800:'#2E5768',
            sage500:'#87A582', sage700:'#4F6B4C', line:'#E8EDF1' };
const W=1200,H=675;

// 1 FUNKTIONALE ATMUNG - konzentrische Boegen, die nach aussen weiter werden:
//    das nutzbare Volumen, das sich oeffnet. Alle Bereiche = alle Ringe.
const funktional = `
<rect width="${W}" height="${H}" fill="${C.oceanImageBg}"/>
${[...Array(9)].map((_,i)=>{
  const r=70+i*46, o=(0.55-i*0.05).toFixed(2), sw=(2.4-i*0.15).toFixed(2);
  return `<circle cx="${W/2}" cy="${H*0.94}" r="${r}" fill="none" stroke="${C.ocean700}" stroke-opacity="${o}" stroke-width="${sw}"/>`;
}).join('')}
<circle cx="${W/2}" cy="${H*0.94}" r="34" fill="${C.ocean700}" fill-opacity="0.85"/>`;

// 2 BALANCE - zwei gespiegelte Wellen um eine Mittellinie: Sympathikus und
//    Parasympathikus, gleich stark, gegenlaeufig, sie treffen sich.
const wave=(amp,phase,y)=>{let d=`M 0 ${y}`;for(let x=0;x<=W;x+=8){d+=` L ${x} ${(y+Math.sin((x/W)*Math.PI*3+phase)*amp).toFixed(1)}`;}return d;};
const balance = `
<rect width="${W}" height="${H}" fill="${C.oceanTint}"/>
<line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="${C.line}" stroke-width="1.5"/>
<path d="${wave(96,0,H/2)}" fill="none" stroke="${C.ocean700}" stroke-opacity="0.8" stroke-width="2.6"/>
<path d="${wave(-96,0,H/2)}" fill="none" stroke="${C.sage700}" stroke-opacity="0.75" stroke-width="2.6"/>
<path d="${wave(48,0,H/2)}" fill="none" stroke="${C.ocean500}" stroke-opacity="0.45" stroke-width="1.6"/>
<path d="${wave(-48,0,H/2)}" fill="none" stroke="${C.sage500}" stroke-opacity="0.45" stroke-width="1.6"/>`;

// 3 ENERGY - ein Atemmuster als beidseitige Kurve um die Mittellinie: Runden,
//    die aufbauen und wieder abklingen. Bewusst KEIN nach oben steigender
//    Balken-Verlauf - der las sich wie ein Umsatzdiagramm, nicht wie eine
//    Atemsession.
const energy = (() => {
  const mitte = H/2, n = 46, links = 80, spanne = W-160;
  let striche = '';
  for (let i=0;i<n;i++){
    const t=i/(n-1), x=links+t*spanne;
    // Zwei Runden: aufbauen, abklingen, wieder aufbauen.
    const huelle=Math.sin(t*Math.PI*2.0)*0.55+0.45;
    const puls=0.55+0.45*Math.sin(t*Math.PI*11);
    const h=(34+huelle*puls*210);
    const o=(0.3+huelle*0.5).toFixed(2);
    striche+=`<line x1="${x.toFixed(0)}" y1="${(mitte-h).toFixed(0)}" x2="${x.toFixed(0)}" y2="${(mitte+h).toFixed(0)}" stroke="${C.ocean700}" stroke-opacity="${o}" stroke-width="5" stroke-linecap="round"/>`;
  }
  return `<rect width="${W}" height="${H}" fill="${C.sageTint}"/>
<line x1="40" y1="${mitte}" x2="${W-40}" y2="${mitte}" stroke="${C.sage700}" stroke-opacity="0.3" stroke-width="1.5"/>
${striche}`;
})();

// 4 RELAX - eine Welle, die ausschwingt und in eine ruhige Gerade uebergeht:
//    herunterkommen, bis es still ist.
let relaxPath=`M 0 ${H/2}`;
for(let x=0;x<=W;x+=6){const t=x/W;const amp=150*Math.exp(-3.1*t);relaxPath+=` L ${x} ${(H/2+Math.sin(t*Math.PI*5)*amp).toFixed(1)}`;}
const relax = `
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<path d="${relaxPath}" fill="none" stroke="${C.ocean700}" stroke-opacity="0.75" stroke-width="2.8" stroke-linecap="round"/>
<path d="${relaxPath}" fill="none" stroke="${C.ocean500}" stroke-opacity="0.3" stroke-width="9" stroke-linecap="round" transform="translate(0,26)"/>
<circle cx="${W-70}" cy="${H/2}" r="7" fill="${C.ocean700}" fill-opacity="0.8"/>`;

const bilder = { 'online-funktionale-atmung':funktional, 'online-balance':balance,
                 'online-energy':energy, 'online-relax':relax };

const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:W,height:H} });
for (const [name, inner] of Object.entries(bilder)) {
  await p.setContent(`<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg></body>`);
  await p.screenshot({ path: `${process.argv[2]}/${name}.png` });
}
await b.close();
console.log(Object.keys(bilder).join(', '));
