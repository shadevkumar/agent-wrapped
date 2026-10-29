// Agent Wrapped story player. Draws every card on one canvas, tall (9:16) on
// narrow screens and wide (16:9) on wide ones, so what you watch is exactly
// what gets saved as an image or a video.
//
// The same page plays two kinds of story: your own, built into the file on
// your computer, and one someone shared, packed into the link after "#v1.".

// ---------------------------------------------------------------- story data

const COMMAND = "npx @shadevkumar/agent-wrapped";

const toast = document.getElementById("toast");
let toastTimer = 0;
function notify(message, { stay = false } = {}) {
  if (toast.textContent !== message) toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  if (!stay) toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

// Everything the home page needs is set up above the line where the script
// stops for a link with no story in it.
for (const btn of document.querySelectorAll("[data-copy-command]")) btn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(COMMAND);
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = "Copy"), 1800);
  } catch {
    notify(`Couldn't copy it. Type ${COMMAND} in your terminal.`);
  }
});

const PLAYER_URL = JSON.parse(document.getElementById("player-url").textContent);
const OWN = JSON.parse(document.getElementById("data").textContent);
const SHARED = !OWN;
// A new link in the same tab, like "Watch Shadev's story", starts over.
if (SHARED) addEventListener("hashchange", () => location.reload());
const D = OWN ?? (await openLink());
if (!D) await new Promise(() => {}); // nothing to play; the page says why
const YEAR = D.range?.to.slice(0, 4) ?? "";

// The public page with no story in its link is the home page.
async function openLink() {
  document.getElementById("player").hidden = true;
  if (!location.hash) {
    document.getElementById("home").hidden = false;
    typeMoments();
    return null;
  }
  try {
    const d = await unpack(location.hash.replace(/^#v1\./, ""));
    if (typeof d?.prompts === "number" && typeof d.personality?.name === "string") {
      document.getElementById("player").hidden = false;
      return d;
    }
  } catch {}
  document.getElementById("missing").hidden = false;
  return null;
}

// The home page's keys type moments from Shadev's story, the one its
// "Watch Shadev's story" link plays, so the two always match. Everything it
// uses lives inside it: it runs before the rest of the script.
async function typeMoments() {
  const s = await unpack(document.getElementById("featured").hash.replace(/^#v1\./, ""));
  const n = (x) => x.toLocaleString("en-US");
  // The keys that differ from the right spelling stay lit.
  const wrong = (typed, word) => {
    const at = [...typed].flatMap((ch, i) => (ch === word[i] ? [] : [i]));
    return typed.length === word.length ? at : at.slice(0, 1);
  };
  // [what gets typed, which keys stay lit, what it is]
  const MOMENTS = [
    s.topTypo && [s.topTypo.spelling, wrong(s.topTypo.spelling, s.topTypo.word), `Shadev typed this ${n(s.topTypo.count)} times`],
    s.spellings && [s.spellings.spellings[0], wrong(s.spellings.spellings[0], s.spellings.word), `one of Shadev's ${s.spellings.spellings.length} ways to spell ${s.spellings.word}`],
    s.topPrompts[0] && [s.topPrompts[0].text, [], "Shadev's most-sent prompt"],
    s.catchphrase && [s.catchphrase.text, [], `Shadev said this in ${n(s.catchphrase.sessions)} sessions`],
    s.night && [s.night.latest, [], "Shadev's latest prompt of the year"],
  ].filter((m) => m && m[0].length <= 10);
  const row = document.getElementById("home-keys");
  const note = document.getElementById("home-note");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (ch) => {
    const k = document.createElement("span");
    k.className = ch === " " ? "key space" : "key";
    k.textContent = ch;
    return k;
  };
  const show = ([word, lit, what]) => {
    row.replaceChildren(...[...word].map(key));
    for (const i of lit) row.children[i].classList.add("lit");
    note.textContent = what;
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return show(MOMENTS[0]);
  for (let m = 0; ; m = (m + 1) % MOMENTS.length) {
    const [word, lit, what] = MOMENTS[m];
    for (const [i, ch] of [...word].entries()) {
      const k = row.appendChild(key(ch));
      k.classList.add("down");
      await wait(70);
      k.classList.remove("down");
      if (lit.includes(i)) k.classList.add("lit");
      await wait(60 + Math.random() * 90);
    }
    note.textContent = what;
    note.classList.add("show");
    await wait(2600);
    note.classList.remove("show");
    while (row.lastChild) {
      row.lastChild.remove();
      await wait(38);
    }
    await wait(450);
  }
}

// JSON, compressed and written with link-safe characters.
async function pack(data) {
  const stream = new Blob([JSON.stringify(data)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function unpack(text) {
  const bytes = Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return JSON.parse(await new Response(stream).text());
}
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Each card has up to three parts: a heading, a visual (the keys) and words
// below. A shape decides where they go:
// - tall: stacked top to bottom, centred as one block
// - wide: the visual on the left, heading and words on the right
const SHAPES = {
  tall: {
    W: 1080, H: 1920, gap: 100, space: [150, 1700],
    column: { x: 96, w: 888 }, single: { x: 96, w: 888 },
  },
  wide: {
    W: 1920, H: 1080, gap: 56, space: [110, 930],
    left: { x: 140, w: 780 }, right: { x: 1000, w: 780 }, single: { x: 260, w: 1400 },
  },
};
let shape = SHAPES.tall; // the shape being drawn right now

// One graphite keyboard for every card. Dark keys with white legends; the one
// key that matters (a wrong key, a reveal) is the light one.
const KEYS = {
  plate: "#1D1E21", ink: "#F1F1EF", soft: "#A4A6AC", faint: "#70737A",
  cap: "#2C2E32", top: "#36383D", side: "#131416", legend: "#EDEDEB",
};
const LIT = { cap: "#E4E4E0", top: "#F6F6F3", side: "#8E8F8C", legend: "#1D1E21" };
const GHOST = { cap: "rgba(255,255,255,0.035)", top: "rgba(255,255,255,0.05)", side: "rgba(0,0,0,0.3)", legend: KEYS.legend, flat: true };

// ---------------------------------------------------------------- helpers

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeBack = (x) => {
  const c = 1.7;
  const t = clamp(x) - 1;
  return 1 + (c + 1) * t * t * t + c * t * t;
};
const fade = (t, at, dur = 0.45) => (REDUCED ? 1 : easeOut((t - at) / dur));
const num = (n) => Math.round(n).toLocaleString("en-US");
const day = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function font(size, { family = "Newsreader", weight = 400, style = "normal" } = {}) {
  return `${style} ${weight} ${size}px "${family}"`;
}

// Draws wrapped text inside box `b`; returns the y below the last line.
function text(ctx, b, str, y, o = {}) {
  const size = o.size ?? 46;
  const lh = size * (o.lh ?? (o.family === "Geist" ? 1.1 : 1.3));
  ctx.save();
  ctx.font = font(size, o);
  // Large sans headings sit tighter, like display type.
  if (o.family === "Geist" && size >= 56) ctx.letterSpacing = `${-size * 0.03}px`;
  ctx.fillStyle = o.color;
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "alphabetic";
  const x = o.align === "center" ? b.x + b.w / 2 : o.align === "right" ? b.x + b.w : b.x;
  const lines = wrap(ctx, str, b.w);
  if (!o.measure) lines.forEach((l, i) => ctx.fillText(l, x, y + size + i * lh));
  ctx.restore();
  return y + size + (lines.length - 1) * lh + size * 0.45;
}

function wrap(ctx, str, max) {
  const lines = [];
  for (const para of String(str).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > max && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function textWidth(ctx, str, size, o) {
  ctx.save();
  ctx.font = font(size, o);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// One low-profile keycap, centred on (cx, cy). `press` 0..1 pushes the top
// down and lights it from below, like a backlit key.
// `label` is a single centred legend; `lines` stacks several (left-aligned
// with `left: true`), and `right` sits at the far edge.
function cap(ctx, cx, cy, w, h, label, o) {
  const scale = o.scale ?? 1;
  if (scale <= 0 || w <= 0) return;
  const s = Math.min(w, h);
  const depth = Math.min(s * 0.07, 12);
  const press = clamp(o.press ?? 0);
  const r = Math.min(s * 0.14, 30);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  roundRect(ctx, 0, 0, w, h, r);
  if (!o.flat) {
    ctx.shadowColor = press > 0 ? `rgba(255,255,255,${0.28 * press})` : "rgba(0,0,0,0.45)";
    ctx.shadowBlur = press > 0 ? Math.min(s * 0.5, 90) : Math.min(s * 0.22, 44);
    ctx.shadowOffsetY = press > 0 ? 0 : Math.min(s * 0.08, 16);
  }
  ctx.fillStyle = o.side;
  ctx.fill();
  ctx.shadowColor = "transparent";
  const top = depth * 0.6 * press;
  const faceH = h - depth;
  roundRect(ctx, 1.5, top, w - 3, faceH, r * 0.92);
  const face = ctx.createLinearGradient(0, top, 0, top + faceH);
  face.addColorStop(0, o.top ?? o.cap);
  face.addColorStop(1, o.cap);
  ctx.fillStyle = face;
  ctx.fill();
  // A hairline of light along the top edge.
  const edge = ctx.createLinearGradient(0, top, 0, top + faceH * 0.5);
  edge.addColorStop(0, "rgba(255,255,255,0.16)");
  edge.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const midY = top + faceH / 2;
  ctx.fillStyle = o.legend;
  ctx.textBaseline = "middle";
  if (label) {
    ctx.font = font(o.fontSize ?? s * 0.4, { family: "Geist", weight: o.weight ?? 500 });
    ctx.textAlign = "center";
    ctx.fillText(label, w / 2, midY + s * 0.02);
  }
  const pad = o.pad ?? 40;
  if (o.lines) {
    const gap = 14;
    const total = o.lines.reduce((sum, l) => sum + l.size, 0) + gap * (o.lines.length - 1);
    let y = midY - total / 2;
    for (const l of o.lines) {
      ctx.font = font(l.size, l);
      ctx.globalAlpha = (o.alpha ?? 1) * (l.alpha ?? 1);
      ctx.textAlign = o.left ? "left" : "center";
      ctx.fillText(l.text, o.left ? pad : w / 2, y + l.size / 2);
      y += l.size + gap;
    }
    ctx.globalAlpha = o.alpha ?? 1;
  }
  if (o.right) {
    ctx.font = font(o.right.size, o.right);
    ctx.textAlign = "right";
    ctx.fillText(o.right.text, w - pad, midY);
  }
  ctx.restore();
}

const pressAt = (local) => (local >= 0 && local < 0.14 ? 1 - local / 0.14 : 0);

// Types `labels` onto a row of caps centred in box `b`, one key every `step` seconds.
function typeRow(ctx, b, labels, cy, size, t, t0, fx, cw, o = {}) {
  const gap = size * 0.14;
  const widths = labels.map((l) => (o.narrow?.(l) ? size * 0.55 : size));
  let total = widths.reduce((a, c) => a + c, 0) + gap * (labels.length - 1);
  const fit = Math.min(1, b.w / total);
  total *= fit;
  let x = b.x + b.w / 2 - total / 2;
  const step = o.step ?? 0.1;
  labels.forEach((label, i) => {
    const w = widths[i] * fit;
    const at = t0 + i * step;
    fx.key(at);
    const local = REDUCED ? 9 : t - at;
    if (local >= 0) {
      cap(ctx, x + w / 2, cy, w, size * fit, label, {
        ...cw,
        scale: 0.7 + 0.3 * easeBack(local / 0.2),
        alpha: clamp(local / 0.08),
        press: local < 0.16 ? 1 - local / 0.16 : 0,
      });
    }
    x += w + gap * fit;
  });
}

// "The Midnight Foreman" -> "MF"
function initials(name) {
  return name
    .replace(/^The /, "")
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function watermark(ctx, cw) {
  text(ctx, { x: 0, w: shape.W }, `made with ${COMMAND}`, shape.H - (shape === SHAPES.wide ? 84 : 124), {
    family: "Geist", weight: 500, size: 26, color: cw.faint, align: "center",
  });
}

// Graphite with one soft light from above.
function background(ctx) {
  ctx.fillStyle = KEYS.plate;
  ctx.fillRect(0, 0, shape.W, shape.H);
  const light = ctx.createRadialGradient(shape.W / 2, -shape.H * 0.15, 0, shape.W / 2, -shape.H * 0.15, Math.max(shape.W, shape.H));
  light.addColorStop(0, "rgba(255,255,255,0.07)");
  light.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, shape.W, shape.H);
}

// ---------------------------------------------------------------- sound

// Synthesised clacks and a chime: no audio files, nothing downloaded.
const Sound = {
  ctx: null,
  master: null,
  on: true,
  noise: null,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    const len = Math.floor(this.ctx.sampleRate * 0.05);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  },
  key() {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1800 + Math.random() * 1400;
    band.Q.value = 1.2;
    const g = c.createGain();
    g.gain.value = 0.9;
    src.connect(band).connect(g).connect(this.master);
    src.start(now);
    // The low "thock" of the key bottoming out.
    const osc = c.createOscillator();
    const og = c.createGain();
    osc.frequency.setValueAtTime(190 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.05);
    og.gain.setValueAtTime(0.35, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(og).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);
  },
  ding() {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    const now = c.currentTime;
    for (const [f, v] of [[880, 0.22], [1320, 0.12], [1760, 0.06]]) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(v, now);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 1.1);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 1.2);
    }
  },
};

// Fires sounds when playback crosses their moment, once per crossing.
function effects(prev, t, live) {
  const crossed = (at) => live && prev < at && at <= t;
  return {
    key: (at) => crossed(at) && Sound.key(),
    ding: (at) => crossed(at) && Sound.ding(),
  };
}
const SILENT = { key() {}, ding() {} };

// ---------------------------------------------------------------- cards

// Every part is drawn as draw(ctx, t, fx, cw, b): `b` is its box ({ x, w }),
// and it starts at y = 0. The layout moves it into place afterwards.
function buildCards(D) {
  const cards = [];
  const add = (card) => cards.push({ cw: KEYS, ...card });
  const chars = (s) => [...s];
  const narrow = (l) => l === "," || l === ":" || l === ".";
  const big = (size) => ({ family: "Geist", weight: 600, size });
  const say = (size = 50) => ({ size, style: "italic" });

  add({
    id: "intro", name: "Intro", dur: 6,
    alt: "Your agents have been talking about you.",
    visual: (ctx, t, fx, cw, b) => typeRow(ctx, b, ["h", "e", "y"], 120, 210, t, 0.4, fx, cw, { step: 0.17 }),
    words(ctx, t, fx, cw, b) {
      const y = text(ctx, b, "Your agents have been talking about you.", 0, { ...big(78), color: cw.ink, alpha: fade(t, 1.3) });
      if (D.range) {
        text(ctx, b, `Here's what we noticed, ${day(D.range.from)} to ${day(D.range.to)}.`, y + 20, {
          ...say(48), color: cw.soft, alpha: fade(t, 2.1),
        });
      }
    },
  });

  add({
    id: "prompts", name: "Prompts", dur: 6.5,
    alt: `You sent your agents ${num(D.prompts)} prompts over ${num(D.activeDays)} days.`,
    head: (ctx, t, fx, cw, b) => text(ctx, b, "Prompts you sent us", 0, { ...say(54), color: cw.soft, alpha: fade(t, 0.2) }),
    visual: (ctx, t, fx, cw, b) => typeRow(ctx, b, chars(num(D.prompts)), 100, 168, t, 0.7, fx, cw, { narrow, step: 0.13 }),
    words: (ctx, t, fx, cw, b) =>
      text(ctx, b, `Over ${num(D.activeDays)} days and ${num(D.sessions)} sessions.`, 0, {
        ...big(72), color: cw.ink, alpha: fade(t, 1.8),
      }),
  });

  if (D.topTypo) {
    const tt = D.topTypo;
    add({
      id: "top-typo", name: "Top typo", dur: 6.5,
      alt: `You typed ${tt.spelling} ${num(tt.count)} times. We read it as ${tt.word}.`,
      visual: (ctx, t, fx, cw, b) => typeRow(ctx, b, chars(tt.spelling), 120, 220, t, 0.4, fx, cw, { step: 0.16 }),
      words(ctx, t, fx, cw, b) {
        const y = text(ctx, b, `You typed ${tt.spelling} ${num(tt.count)} times.`, 0, { ...big(76), color: cw.ink, alpha: fade(t, 1.3) });
        text(ctx, b, `We read it as “${tt.word}”. Every single time.`, y + 16, { ...say(), color: cw.soft, alpha: fade(t, 2.2) });
      },
    });
  }

  if (D.spellings) {
    const sp = D.spellings;
    const list = sp.spellings.slice(0, 24);
    const each = clamp(5 / list.length, 0.14, 0.4);
    const t0 = 0.6;
    const settle = t0 + list.length * each;
    add({
      id: "spellings", name: "Spellings", dur: settle + 4,
      alt: `There are ${sp.spellings.length + 1} ways to spell ${sp.word}. You used all of them.`,
      head: (ctx, t, fx, cw, b) => text(ctx, b, `How you spell ${sp.word}`, 0, { ...big(70), color: cw.ink }),
      visual(ctx, t, fx, cw, b) {
        const i = REDUCED ? list.length : Math.floor((t - t0) / each);
        const done = i >= list.length;
        list.forEach((_, k) => fx.key(t0 + k * each));
        fx.ding(settle);
        if (t < t0 && !REDUCED) return;
        const word = done ? sp.word : list[clamp(i, 0, list.length - 1)];
        const local = done ? t - settle : (t - t0) % each;
        const size = Math.min(150, (b.w / word.length) * 0.86);
        const gap = size * 0.14;
        let x = b.x + b.w / 2 - (word.length * size + (word.length - 1) * gap) / 2;
        for (const ch of word) {
          cap(ctx, x + size / 2, 100, size, size, ch, {
            ...(done ? cw : LIT), press: local < 0.1 && !REDUCED ? 1 - local / 0.1 : 0,
          });
          x += size + gap;
        }
      },
      words(ctx, t, fx, cw, b) {
        // Drawn invisibly before it settles, so the layout keeps its place.
        const a = t >= settle || REDUCED ? 1 : 0;
        const y = text(ctx, b, `${sp.spellings.length + 1} ways to spell it.`, 0, {
          ...big(72), color: cw.ink, alpha: a * fade(t, settle + 0.2),
        });
        text(ctx, b, "We know, because you used all of them.", y + 16, { ...say(), color: cw.soft, alpha: a * fade(t, settle + 1) });
      },
    });
  }

  if (D.slip) {
    const s = D.slip;
    const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
    const taps = [1.4, 1.75, 2.1, 2.45];
    add({
      id: "slip", name: "Missed key", dur: 7,
      alt: `You meant ${s.meant.toUpperCase()} and hit ${s.hit.toUpperCase()}, ${num(s.count)} times.`,
      head: (ctx, t, fx, cw, b) =>
        text(ctx, b, `You meant ${s.meant.toUpperCase()}.\nYou hit ${s.hit.toUpperCase()}.`, 0, { ...big(84), color: cw.ink }),
      visual(ctx, t, fx, cw, b) {
        const gap = 10;
        const size = Math.min(82, (b.w - 9 * gap) / 10.6);
        taps.forEach((at) => fx.key(at));
        const sinceTap = Math.min(...taps.map((at) => (t >= at ? t - at : 9)));
        rows.forEach((row, r) => {
          const rowW = row.length * size + (row.length - 1) * gap;
          const x0 = b.x + b.w / 2 - rowW / 2 + r * size * 0.3;
          [...row].forEach((ch, c) => {
            const cx = x0 + c * (size + gap) + size / 2;
            const cy = size / 2 + 20 + r * (size + gap + 8);
            const isHit = ch === s.hit && t >= taps[0];
            if (ch === s.meant && t >= 0.8) {
              ctx.save();
              ctx.strokeStyle = KEYS.ink;
              ctx.lineWidth = 3;
              ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 5) ** 2;
              roundRect(ctx, cx - size / 2 - 10, cy - size / 2 - 10, size + 20, size + 26, 22);
              ctx.stroke();
              ctx.restore();
            }
            cap(ctx, cx, cy, size, size, ch, {
              ...(isHit ? LIT : cw), fontSize: size * 0.42, press: isHit && sinceTap < 0.14 ? 1 - sinceTap / 0.14 : 0,
            });
          });
        });
      },
      words: (ctx, t, fx, cw, b) =>
        text(ctx, b, `${num(s.count)} times. They're neighbours, so we let it slide.`, 0, { ...say(), color: cw.soft, alpha: fade(t, 2.8) }),
    });
  }

  if (D.topPrompts.length) {
    const top = D.topPrompts;
    const most = top[0].count;
    const last = 0.6 + (top.length - 1) * 0.35;
    add({
      id: "top-prompts", name: "Favourite prompts", dur: 6.5,
      alt: `Your favourite things to say to us: ${top.map((p) => `${p.text}, ${p.count} times`).join("; ")}.`,
      head: (ctx, t, fx, cw, b) => text(ctx, b, "Your favourite things to say to us", 0, { ...big(70), color: cw.ink }),
      visual(ctx, t, fx, cw, b) {
        top.forEach((p, i) => {
          const at = 0.6 + i * 0.35;
          fx.key(at);
          const local = REDUCED ? 9 : t - at;
          if (local < 0) return;
          const label = { text: `“${p.text}”`, size: 44, family: "Geist", weight: 500 };
          const right = { text: `${p.count}×`, size: 40, family: "Geist", weight: 400 };
          const least = textWidth(ctx, label.text, 46, label) + textWidth(ctx, right.text, 46, right) + 140;
          const w = Math.min(b.w, least + (b.w - least) * (p.count / most) * easeOut(local / 0.5));
          cap(ctx, b.x + w / 2, 80 + i * 190, w, 140, "", { ...cw, left: true, lines: [label], right, press: pressAt(local) });
        });
      },
      words: (ctx, t, fx, cw, b) =>
        text(ctx, b, "Short, clear and a little bossy. We like it.", 0, { ...say(), color: cw.soft, alpha: fade(t, last + 0.5) }),
    });
  }

  if (D.catchphrase) {
    const c = D.catchphrase;
    add({
      id: "catchphrase", name: "Catchphrase", dur: 6,
      alt: `Your catchphrase: ${c.text}. You said it in ${c.sessions} different sessions.`,
      head(ctx, t, fx, cw, b) {
        fx.ding(0.5);
        const y = text(ctx, b, "Your catchphrase", 0, { ...say(54), color: cw.soft });
        text(ctx, b, `“${c.text}”`, y + 30, { size: 150, weight: 600, style: "italic", color: cw.ink, lh: 1.02, alpha: fade(t, 0.5, 0.7) });
      },
      words: (ctx, t, fx, cw, b) =>
        text(ctx, b, `You said it in ${num(c.sessions)} different sessions. It's basically your motto now.`, 0, {
          ...say(), color: cw.soft, alpha: fade(t, 1.6),
        }),
    });
  }

  if (D.talk) {
    const k = D.talk;
    const word = k.nickname?.word ?? "please";
    const lines = [
      k.nickname ? `You called us “${k.nickname.word}” ${num(k.nickname.count)} times.` : `You said please ${num(k.please)} times.`,
      k.nickname && k.please + k.thanks > 0 && `Please ${num(k.please)} times. Thanks ${num(k.thanks)}.${k.thanks * 3 < k.please ? " We noticed." : ""}`,
      !k.nickname && `And thanks ${num(k.thanks)} times.`,
      k.checkIns >= 20 && `And you asked “okay?” ${num(k.checkIns)} times.`,
    ].filter(Boolean);
    add({
      id: "talk", name: "How you talk", dur: 7,
      alt: `How you talk to us. ${lines.join(" ")}`,
      head: (ctx, t, fx, cw, b) => text(ctx, b, "How you talk to us", 0, { ...say(54), color: cw.soft }),
      visual: (ctx, t, fx, cw, b) => typeRow(ctx, b, chars(word), 120, 210, t, 0.4, fx, cw, { step: 0.16 }),
      words(ctx, t, fx, cw, b) {
        let y = text(ctx, b, lines[0], 0, { ...big(72), color: cw.ink, alpha: fade(t, 1.4) });
        lines.slice(1).forEach((line, i) => {
          y = text(ctx, b, line, y + 18, { ...say(), color: cw.soft, alpha: fade(t, 2.2 + i * 0.8) });
        });
      },
    });
  }

  if (D.night) {
    const n = D.night;
    add({
      id: "night", name: "Late night", dur: 6.5,
      alt: `Your latest prompt after midnight was at ${n.latest}. ${num(n.prompts)} prompts after midnight.`,
      head: (ctx, t, fx, cw, b) => text(ctx, b, "Your latest prompt after midnight", 0, { ...say(54), color: cw.soft }),
      visual: (ctx, t, fx, cw, b) => typeRow(ctx, b, chars(n.latest), 110, 190, t, 0.6, fx, cw, { narrow, step: 0.15 }),
      words: (ctx, t, fx, cw, b) =>
        text(ctx, b, `${num(n.prompts)} prompts after 12 a.m. We were up too.`, 0, { ...big(68), color: cw.ink, alpha: fade(t, 1.8) }),
    });
  }

  if (D.streak) {
    const s = D.streak;
    const shown = Math.min(s.days, 42);
    const step = clamp(2.4 / shown, 0.04, 0.12);
    const end = 0.4 + shown * step;
    add({
      id: "streak", name: "Streak", dur: 4 + shown * step,
      alt: `${s.days} days in a row, ${day(s.from)} to ${day(s.to)}.`,
      visual(ctx, t, fx, cw, b) {
        const gap = 20;
        const size = Math.min(104, (b.w - 6 * gap) / 7);
        const x0 = b.x + b.w / 2 - (7 * size + 6 * gap) / 2;
        for (let i = 0; i < shown; i++) {
          const at = 0.4 + i * step;
          fx.key(at);
          const local = REDUCED ? 9 : t - at;
          const lit = local >= 0;
          cap(ctx, x0 + (i % 7) * (size + gap) + size / 2, size / 2 + 10 + Math.floor(i / 7) * (size + gap + 10), size, size,
            lit ? String(i + 1) : "", {
              ...(lit ? cw : GHOST),
              fontSize: size * 0.33,
              press: lit ? pressAt(local) : 0,
            });
        }
      },
      words(ctx, t, fx, cw, b) {
        const y = text(ctx, b, `${s.days} days in a row.`, 0, { ...big(84), color: cw.ink, alpha: fade(t, end) });
        text(ctx, b, `${day(s.from)} to ${day(s.to)}. Not one day off.`, y + 10, { ...say(), color: cw.soft, alpha: fade(t, end + 0.7) });
      },
    });
  }

  if (D.agents) {
    const a = D.agents;
    const parts = [["Codex", a.codex], ["Claude", a.claude]].filter(([, v]) => v > 0);
    add({
      id: "agents", name: "Your agents", dur: 6.5,
      alt: `${num(a.hours)} hours of agent work. Codex ${Math.round(a.codex * 100)} percent, Claude ${Math.round(a.claude * 100)} percent.`,
      head: (ctx, t, fx, cw, b) => text(ctx, b, `${num(a.hours)} hours of work, split between two of us.`, 0, { ...big(72), color: cw.ink }),
      visual(ctx, t, fx, cw, b) {
        parts.forEach(([name, share], i) => {
          const at = 0.7 + i * 0.4;
          fx.key(at);
          const local = REDUCED ? 9 : t - at;
          if (local < 0) return;
          const label = { text: `${name} ${Math.round(share * 100)}%`, size: 48, family: "Geist", weight: 500 };
          const least = textWidth(ctx, label.text, 52, label) + 100;
          const w = Math.max(least, b.w * share) * easeOut(local / 0.6);
          cap(ctx, b.x + w / 2, 95 + i * 230, w, 170, "", { ...cw, left: true, lines: [label], press: pressAt(local) });
        });
      },
      words: (ctx, t, fx, cw, b) =>
        a.bothDays > 0 &&
        text(ctx, b, `Some days you needed both of us. ${num(a.bothDays)} of them, to be exact.`, 0, {
          ...say(), color: cw.soft, alpha: fade(t, 2),
        }),
    });
  }

  if (D.work) {
    const w = D.work;
    const rows = [["ran your tests", w.tests], ["made commits", w.commits], ["got stopped by you", w.stops]].filter(([, n]) => n > 0);
    const most = Math.max(...rows.map(([, n]) => n));
    const last = 0.6 + (rows.length - 1) * 0.35;
    add({
      id: "work", name: "What we did", dur: 7,
      alt: `What we got done, since ${day(w.since)}: ${rows.map(([what, n]) => `${what}, ${num(n)} times`).join("; ")}.${w.languages.length ? ` Mostly in ${w.languages.join(" and ")}.` : ""}`,
      head: (ctx, t, fx, cw, b) => text(ctx, b, "What we got done", 0, { ...big(70), color: cw.ink }),
      visual(ctx, t, fx, cw, b) {
        rows.forEach(([what, n], i) => {
          const at = 0.6 + i * 0.35;
          fx.key(at);
          const local = REDUCED ? 9 : t - at;
          if (local < 0) return;
          const label = { text: what, size: 44, family: "Geist", weight: 500 };
          const right = { text: `${num(n)}×`, size: 40, family: "Geist", weight: 400 };
          const least = textWidth(ctx, label.text, 46, label) + textWidth(ctx, right.text, 46, right) + 140;
          const width = Math.min(b.w, least + (b.w - least) * (n / most) * easeOut(local / 0.5));
          cap(ctx, b.x + width / 2, 80 + i * 190, width, 140, "", { ...cw, left: true, lines: [label], right, press: pressAt(local) });
        });
      },
      words(ctx, t, fx, cw, b) {
        const y = w.languages.length
          ? text(ctx, b, `Mostly in ${w.languages.join(" and ")}.`, 0, { ...say(), color: cw.soft, alpha: fade(t, last + 0.5) }) + 20
          : 0;
        text(ctx, b, `Counted from the logs your agents keep, since ${day(w.since)}.`, y, {
          size: 34, color: cw.faint, alpha: fade(t, last + 1.2),
        });
      },
    });
  }

  if (D.money) {
    const m = D.money;
    add({
      id: "money", name: "API value", dur: 7,
      alt: `At least ${num(m.atLeastUsd)} US dollars of agent work at public API prices.`,
      head: (ctx, t, fx, cw, b) => text(ctx, b, "Our work, at public API prices", 0, { ...say(54), color: cw.soft }),
      visual: (ctx, t, fx, cw, b) => typeRow(ctx, b, chars(`$${num(m.atLeastUsd)}`), 100, 150, t, 0.6, fx, cw, { narrow, step: 0.12 }),
      words(ctx, t, fx, cw, b) {
        const y = text(ctx, b, "At least. We priced what we could count exactly, and the rest at the cheapest rate.", 0, {
          ...say(), color: cw.soft, alpha: fade(t, 1.8),
        });
        text(ctx, b, `Public prices on ${day(m.pricesAsOf)}. Your plan probably cost a lot less.`, y + 20, {
          size: 34, color: cw.faint, alpha: fade(t, 2.6),
        });
      },
    });
  }

  const p = D.personality;
  const reveal = 2.2;
  add({
    id: "personality", name: "Personality", dur: 8,
    alt: `You are ${p.name}. ${p.line}`,
    head: (ctx, t, fx, cw, b) => text(ctx, b, "So, who are you?", 0, { ...say(54), color: cw.soft }),
    visual(ctx, t, fx, cw, b) {
      [0.5, 0.8, 1.05, 1.25, 1.42, 1.56, 1.68, 1.78].forEach((at) => fx.key(at));
      fx.ding(reveal);
      const revealed = t >= reveal || REDUCED;
      cap(ctx, b.x + b.w / 2, 150, 280, 280, revealed ? initials(p.name) : "?", {
        ...(revealed ? LIT : cw),
        fontSize: 104,
        weight: 600,
        scale: revealed ? 0.9 + 0.1 * easeBack((t - reveal) / 0.3) : 1 + Math.sin(t * 40) * 0.04,
        press: !revealed && (t * 6) % 1 < 0.3 ? 1 : 0,
      });
    },
    words(ctx, t, fx, cw, b) {
      const a = t >= reveal || REDUCED ? 1 : 0;
      const y = text(ctx, b, p.name, 0, { family: "Geist", weight: 700, size: 104, color: cw.ink, lh: 1.05, alpha: a * fade(t, reveal, 0.3) });
      const y2 = text(ctx, b, p.line, y + 30, { size: 52, style: "italic", color: cw.ink, alpha: a * fade(t, reveal + 0.8) });
      if (p.traits.length) {
        const traits = p.traits.map((name) => name.replace(/^The /, "the "));
        text(ctx, b, `With a bit of ${traits.join(" and ")}.`, y2 + 30, { size: 40, color: cw.soft, alpha: a * fade(t, reveal + 1.6) });
      }
    },
  });

  const letterWords = D.letter?.text.split(/\s+/).length;
  if (D.letter) add({
    id: "letter", name: "Letter", dur: Math.max(10, letterWords * 0.28 + 3),
    alt: `A note from your agents: ${D.letter.text}`,
    head: (ctx, t, fx, cw, b) => text(ctx, b, "A note from your agents", 0, { family: "Geist", weight: 600, size: 60, color: cw.ink }),
    words(ctx, t, fx, cw, b) {
      const body = { size: 44, color: cw.ink, lh: 1.42 };
      const inner = { x: b.x + 56, w: b.w - 112 };
      const height = text(ctx, inner, D.letter.text, 0, { ...body, measure: true }) + 76;
      // A quiet sheet, a shade lighter than the page.
      ctx.save();
      ctx.globalAlpha = REDUCED ? 1 : fade(t, 0, 0.5);
      roundRect(ctx, b.x, -4, b.w, height, 28);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      // Words appear at reading pace.
      const shown = REDUCED ? letterWords : Math.floor(clamp((t - 0.6) / 0.22, 0, letterWords));
      let n = 0;
      const visible = D.letter.text
        .split(/(\s+)/)
        .filter((part) => (/\S/.test(part) ? ++n <= shown : n < shown))
        .join("");
      text(ctx, inner, visible, 20, body);
    },
  });

  const tiles = [
    [num(D.prompts), "prompts"],
    D.agents ? [num(D.agents.hours), "hours of agent work"] : null,
    D.topTypo ? [`${D.topTypo.spelling} ×${num(D.topTypo.count)}`, "my favourite typo"] : null,
    D.night ? [D.night.latest, "latest prompt after midnight"] : D.streak ? [`${D.streak.days} days`, "longest streak"] : null,
  ].filter(Boolean);
  add({
    id: "summary", name: "Summary", dur: 8,
    alt: `Summary: ${p.name}. ${num(D.prompts)} prompts.`,
    head(ctx, t, fx, cw, b) {
      const y = text(ctx, b, `My ${YEAR || "year"} with AI agents`, 0, { ...say(), color: cw.soft });
      text(ctx, b, p.name, y + 10, { family: "Geist", weight: 700, size: 92, color: cw.ink, lh: 1.05 });
    },
    visual(ctx, t, fx, cw, b) {
      const tw = (b.w - 30) / 2;
      const th = 300;
      const bigFont = { family: "Geist", weight: 600 };
      tiles.forEach(([value, label], i) => {
        const at = 0.4 + i * 0.25;
        fx.key(at);
        const local = REDUCED ? 9 : t - at;
        if (local < 0) return;
        const fit = Math.min(64, (64 * (tw - 80)) / textWidth(ctx, value, 64, bigFont));
        ctx.save();
        ctx.font = font(34, { family: "Geist" });
        const labelLines = wrap(ctx, label, tw - 80);
        ctx.restore();
        cap(ctx, b.x + (i % 2) * (tw + 30) + tw / 2, th / 2 + Math.floor(i / 2) * (th + 40), tw, th, "", {
          ...cw,
          left: true,
          lines: [{ text: value, size: fit, ...bigFont }, ...labelLines.map((l) => ({ text: l, size: 34, family: "Geist", alpha: 0.55 }))],
          scale: 0.85 + 0.15 * easeBack(local / 0.25),
          press: pressAt(local),
        });
      });
    },
  });

  return cards;
}

// ---------------------------------------------------------------- layout

// Finds the first and last rows a part draws on, by drawing its finished
// state small and looking for pixels that differ from the background.
const probe = document.createElement("canvas");
const PROBE_SCALE = 0.25;
const PROBE_PAD = 200; // room for anything drawn slightly above y = 0
function measure(card, part, b) {
  probe.width = shape.W * PROBE_SCALE;
  probe.height = shape.H * 2 * PROBE_SCALE;
  const c = probe.getContext("2d", { willReadFrequently: true });
  c.fillStyle = card.cw.plate;
  c.fillRect(0, 0, probe.width, probe.height);
  c.setTransform(PROBE_SCALE, 0, 0, PROBE_SCALE, 0, PROBE_PAD * PROBE_SCALE);
  part(c, card.dur, SILENT, card.cw, b);
  const { data, width, height } = c.getImageData(0, 0, probe.width, probe.height);
  const bg = data.slice(0, 3);
  let first = -1;
  let last = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 24) {
        if (first < 0) first = y;
        last = y;
        break;
      }
    }
  }
  if (first < 0) return null;
  return { top: first / PROBE_SCALE - PROBE_PAD, bottom: last / PROBE_SCALE - PROBE_PAD };
}

// Places parts in a column, centred as one block in the shape's space.
function stack(card, parts, b) {
  const placed = [];
  const sized = parts.map((part) => ({ part, box: measure(card, part, b) })).filter((x) => x.box);
  const total = sized.reduce((s, x) => s + (x.box.bottom - x.box.top), 0) + shape.gap * (sized.length - 1);
  const [top, bottom] = shape.space;
  let y = Math.max(top, (top + bottom) / 2 - total / 2);
  for (const { part, box } of sized) {
    placed.push({ part, b, dy: y - box.top });
    y += box.bottom - box.top + shape.gap;
  }
  return placed;
}

function layout(card) {
  card.layouts ??= {};
  const key = shape === SHAPES.wide ? "wide" : "tall";
  if (card.layouts[key]) return card.layouts[key];
  const parts = [card.head, card.visual, card.words].filter(Boolean);
  let placed;
  if (key === "tall") placed = stack(card, parts, shape.column);
  else if (!card.visual) placed = stack(card, parts, shape.single);
  else placed = [...stack(card, [card.visual], shape.left), ...stack(card, [card.head, card.words].filter(Boolean), shape.right)];
  return (card.layouts[key] = placed);
}

function withShape(s, fn) {
  const before = shape;
  shape = s;
  try {
    return fn();
  } finally {
    shape = before;
  }
}

function paint(target, card, t, fx) {
  const c = target.getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0);
  background(c);
  for (const { part, b, dy } of layout(card)) {
    c.save();
    c.translate(0, dy);
    part(c, t, fx, card.cw, b);
    c.restore();
  }
  watermark(c, card.cw);
}

// ---------------------------------------------------------------- player

const cards = buildCards(D);
const stage = document.getElementById("stage");
const frame = document.getElementById("frame");
const bars = document.getElementById("bars");
const live = document.getElementById("live");
bars.innerHTML = cards.map(() => "<span><i></i></span>").join("");

// Wide windows get the wide shape; phones and narrow windows the tall one.
function fitShape() {
  const next = innerWidth / innerHeight > 1.15 ? SHAPES.wide : SHAPES.tall;
  if (next === shape && stage.width === next.W) return;
  shape = next;
  stage.width = shape.W;
  stage.height = shape.H;
  frame.dataset.shape = shape === SHAPES.wide ? "wide" : "tall";
}

const state = { index: 0, started: 0, playing: false, holdPaused: false, pausedAt: 0, prevT: 0, mode: "player" };

function show(index) {
  state.index = clamp(index, 0, cards.length - 1);
  state.started = performance.now();
  state.prevT = -1;
  live.textContent = cards[state.index].alt;
}

function elapsed(now) {
  return ((state.holdPaused ? state.pausedAt : now) - state.started) / 1000;
}

function tick(now) {
  if (state.mode === "player") {
    const card = cards[state.index];
    // Before play, the first card shows finished behind the start button.
    const t = state.playing ? elapsed(now) : card.dur;
    paint(stage, card, t, effects(state.prevT, t, state.playing && !state.holdPaused));
    state.prevT = t;
    [...bars.children].forEach((bar, i) => {
      bar.firstChild.style.width = `${i < state.index ? 100 : i > state.index ? 0 : clamp(t / card.dur) * 100}%`;
    });
    if (state.playing && !state.holdPaused && t >= card.dur) {
      if (state.index === cards.length - 1) openShare();
      else show(state.index + 1);
    }
  }
  requestAnimationFrame(tick);
}

addEventListener("resize", () => {
  if (state.mode === "player") fitShape();
});

document.getElementById("play").addEventListener("click", () => {
  Sound.init();
  document.getElementById("start").remove();
  state.playing = true;
  show(0);
});

// Tap right side: next. Tap left: back. Press and hold: pause.
let holdTimer = 0;
stage.addEventListener("pointerdown", () => {
  if (!state.playing) return;
  holdTimer = setTimeout(() => {
    state.holdPaused = true;
    state.pausedAt = performance.now();
  }, 220);
});
stage.addEventListener("pointerup", (e) => {
  if (!state.playing) return;
  clearTimeout(holdTimer);
  if (state.holdPaused) {
    state.started += performance.now() - state.pausedAt;
    state.holdPaused = false;
    return;
  }
  const rect = stage.getBoundingClientRect();
  show(state.index + (e.clientX - rect.left < rect.width * 0.3 ? -1 : 1));
});

addEventListener("keydown", (e) => {
  if (state.mode !== "player") return;
  if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey && !e.altKey) {
    saveCurrent();
    return;
  }
  if (!state.playing) return;
  if (e.key === "ArrowRight" || e.key === " ") {
    e.preventDefault();
    if (state.index === cards.length - 1) openShare();
    else show(state.index + 1);
  } else if (e.key === "ArrowLeft") show(state.index - 1);
  else if (e.key === "Escape") openShare();
});

const soundBtn = document.getElementById("sound");
try {
  Sound.on = localStorage.getItem("agent-wrapped-sound") !== "off";
} catch {}
const renderSoundBtn = () => {
  soundBtn.setAttribute("aria-pressed", String(Sound.on));
  soundBtn.textContent = Sound.on ? "Sound on" : "Sound off";
};
renderSoundBtn();
soundBtn.addEventListener("click", () => {
  Sound.on = !Sound.on;
  try {
    localStorage.setItem("agent-wrapped-sound", Sound.on ? "on" : "off");
  } catch {}
  renderSoundBtn();
});
document.getElementById("skip").addEventListener("click", openShare);
document.getElementById("save-now").addEventListener("click", saveCurrent);
if (SHARED) {
  document.getElementById("play").textContent = "Play the story";
  document.getElementById("start-note").textContent = "A year with AI coding agents, wrapped. Sound on for the full effect.";
  document.getElementById("skip").textContent = "Skip to the end";
}

// The buttons fade away while you watch, so a screenshot shows only the card.
const player = document.getElementById("player");
let idleTimer = 0;
function wake() {
  player.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => state.playing && state.mode === "player" && player.classList.add("idle"), 2200);
}
for (const ev of ["pointermove", "pointerdown", "keydown"]) addEventListener(ev, wake);

// Saves the card on screen as it looks when finished.
async function saveCurrent() {
  const i = state.index;
  download(await pngOf(finalFrame(cards[i], shape)), fileName(i, shape));
  notify("Saved this card to your Downloads folder.");
}


// ---------------------------------------------------------------- sharing

const share = document.getElementById("share");
const preview = document.getElementById("share-preview");
const postX = document.getElementById("post-x");
const postLinkedIn = document.getElementById("post-linkedin");

// Cards you can leave out, and the part of the story each one needs.
const LEAVABLE = {
  "top-typo": "topTypo", spellings: "spellings", slip: "slip", "top-prompts": "topPrompts", catchphrase: "catchphrase",
  talk: "talk", night: "night", streak: "streak", agents: "agents", work: "work", money: "money", letter: "letter",
};
const left = new Set(); // ids of the cards left out
let link = "";
let linkFor = 0; // ignores a slower, older link if the choice changed meanwhile

// The story that goes in the link: a card left out is not in it at all.
function sharedData() {
  const d = { ...D };
  for (const id of left) d[LEAVABLE[id]] = id === "top-prompts" ? [] : null;
  return d;
}

const shareText = (d) => `My ${YEAR || "year"} with AI coding agents, wrapped. I'm ${d.personality.name}.`;

function finalFrame(card, s) {
  return withShape(s, () => {
    const c = document.createElement("canvas");
    c.width = s.W;
    c.height = s.H;
    paint(c, card, card.dur, SILENT);
    return c;
  });
}

const pngOf = (canvas) => new Promise((r) => canvas.toBlob(r, "image/png"));
const shapeName = (s) => (s === SHAPES.wide ? "wide" : "tall");
const fileName = (i, s) => `agent-wrapped-${shapeName(s)}-${String(i + 1).padStart(2, "0")}-${cards[i].id}.png`;

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// The summary card stands for the whole story.
function summaryCard() {
  return buildCards(sharedData()).find((c) => c.id === "summary");
}

async function renderShare() {
  const mine = ++linkFor;
  const data = sharedData();
  preview.src = finalFrame(summaryCard(), shape).toDataURL("image/png");
  preview.dataset.shape = shapeName(shape);
  const next = PLAYER_URL ? `${PLAYER_URL}#v1.${await pack(data)}` : "";
  if (mine !== linkFor) return;
  link = next;
  const url = encodeURIComponent(link);
  postX.href = `https://x.com/intent/post?text=${encodeURIComponent(shareText(data))}&url=${url}`;
  postLinkedIn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
  for (const el of document.querySelectorAll("[data-needs-link]")) el.hidden = !link;
  document.getElementById("share-link").hidden = !link || typeof navigator.share !== "function";
  document.getElementById("offline").hidden = !!link;
}

function renderChoices() {
  const list = document.getElementById("choices");
  list.replaceChildren(
    ...cards
      .filter((card) => card.id in LEAVABLE)
      .map((card) => {
        const btn = document.createElement("button");
        btn.className = "chip";
        btn.textContent = card.name;
        const render = () => btn.setAttribute("aria-pressed", String(!left.has(card.id)));
        btn.addEventListener("click", () => {
          if (left.has(card.id)) left.delete(card.id);
          else left.add(card.id);
          render();
          renderShare();
        });
        render();
        return btn;
      }),
  );
}

// Your own story ends on sharing; a shared one ends on how to make your own.
function openShare() {
  state.mode = "share";
  clearTimeout(idleTimer);
  player.hidden = true;
  if (SHARED) {
    document.getElementById("ending").hidden = false;
    document.getElementById("ending-title").focus();
    return;
  }
  share.hidden = false;
  renderChoices();
  renderShare();
  document.getElementById("share-title").focus();
}

document.getElementById("copy-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(link);
    notify("Link copied. Paste it anywhere.");
  } catch {
    notify("Couldn't copy the link. Try Share instead.");
  }
});

document.getElementById("share-link").addEventListener("click", async () => {
  try {
    await navigator.share({ title: "Agent Wrapped", text: shareText(sharedData()), url: link });
  } catch (err) {
    if (err?.name !== "AbortError") notify("Couldn't open sharing. Copy the link instead.");
  }
});

document.getElementById("save-image").addEventListener("click", async () => {
  download(await pngOf(finalFrame(summaryCard(), shape)), `agent-wrapped-${shapeName(shape)}.png`);
  notify("Saved the card to your Downloads folder.");
});


// Plays the story in real time onto a hidden canvas and records it, for
// places that take a video but not a link.
document.getElementById("save-video").addEventListener("click", async (e) => {
  if (typeof MediaRecorder === "undefined") {
    notify("This browser can't record video. Try Chrome, Arc or Safari.");
    return;
  }
  const list = buildCards(sharedData());
  const button = e.currentTarget;
  button.disabled = true;
  Sound.init();
  const s = shape;
  const canvas = document.createElement("canvas");
  canvas.width = s.W;
  canvas.height = s.H;
  const stream = canvas.captureStream(30);
  if (Sound.ctx) {
    const dest = Sound.ctx.createMediaStreamDestination();
    Sound.master.connect(dest);
    dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  }
  const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
  const finished = new Promise((r) => (recorder.onstop = r));
  recorder.start(500);

  const total = list.reduce((sum, c) => sum + c.dur, 0);
  let done = 0;
  for (const card of list) {
    await new Promise((resolve) => {
      const start = performance.now();
      let prev = -1;
      const step = (now) => {
        const t = (now - start) / 1000;
        withShape(s, () => paint(canvas, card, Math.min(t, card.dur), effects(prev, t, true)));
        prev = t;
        notify(`Recording your video, ${Math.floor(((done + Math.min(t, card.dur)) / total) * 100)}%. Keep this tab open.`, { stay: true });
        if (t >= card.dur) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    done += card.dur;
  }
  recorder.stop();
  await finished;
  const ext = type.startsWith("video/mp4") ? "mp4" : "webm";
  download(new Blob(chunks, { type }), `agent-wrapped-${shapeName(s)}.${ext}`);
  notify(`Saved your video to your Downloads folder as agent-wrapped-${shapeName(s)}.${ext}.`);
  button.disabled = false;
});

for (const btn of document.querySelectorAll("[data-replay]")) {
  btn.addEventListener("click", () => {
    share.hidden = true;
    document.getElementById("ending").hidden = true;
    player.hidden = false;
    state.mode = "player";
    fitShape();
    state.playing = true;
    show(0);
  });
}

// Draw the first card once fonts are ready, so nothing flashes in a fallback font.
Promise.all([
  document.fonts.load('600 80px "Geist"'),
  document.fonts.load('400 40px "Newsreader"'),
  document.fonts.load('italic 400 40px "Newsreader"'),
]).finally(() => {
  fitShape();
  requestAnimationFrame(tick);
});
