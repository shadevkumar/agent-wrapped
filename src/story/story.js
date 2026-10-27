// Agent Wrapped story player. Draws every card on one 1080x1920 canvas, so
// what you watch is exactly what gets saved as an image or a video.
"use strict";

const D = JSON.parse(document.getElementById("data").textContent);
const W = 1080;
const H = 1920;
const M = 96; // side margin
const CONTENT = W - M * 2;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Keycap colourways, one per card, like a custom keyboard set.
const CW = {
  ultramarine: { plate: "#2B2FD9", cap: "#F4EEE2", side: "#BFB49B", legend: "#2B2FD9", ink: "#F4EEE2" },
  cherry: { plate: "#D7263D", cap: "#FFE39A", side: "#D9A94A", legend: "#7A0E1E", ink: "#FFF3D1" },
  mint: { plate: "#0F8A72", cap: "#F3F7EF", side: "#B9C8B6", legend: "#0B5E4E", ink: "#EFFFF8" },
  butter: { plate: "#FFC83D", cap: "#1E2A78", side: "#111A52", legend: "#FFE08A", ink: "#1E2A78" },
  lilac: { plate: "#7A5CFF", cap: "#FFFFFF", side: "#CFC3FF", legend: "#4322C9", ink: "#FFFFFF" },
  night: { plate: "#151A5C", cap: "#2A3196", side: "#0A0E3A", legend: "#FFD45E", ink: "#E9EBFF" },
};
const HIT = { cap: "#FF4D5E", side: "#B3182B", legend: "#FFFFFF" };

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

// Draws wrapped text; returns the y below the last line.
function text(ctx, str, x, y, o = {}) {
  const size = o.size ?? 46;
  const lh = size * (o.lh ?? (o.family === "Unbounded" ? 1.14 : 1.3));
  ctx.save();
  ctx.font = font(size, o);
  ctx.fillStyle = o.color;
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "alphabetic";
  const lines = wrap(ctx, str, o.max ?? CONTENT);
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// One keycap, centred on (cx, cy). `press` 0..1 pushes the top down.
// `label` is a single centred legend; `lines` stacks several (left-aligned
// with `left: true`), and `right` sits at the far edge.
function cap(ctx, cx, cy, w, h, label, o) {
  const scale = o.scale ?? 1;
  if (scale <= 0) return;
  const s = Math.min(w, h);
  const depth = Math.min(s * 0.16, 30);
  const press = clamp(o.press ?? 0);
  const r = Math.min(s * 0.2, 48);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  roundRect(ctx, 0, depth * 0.5, w, h, r);
  ctx.fillStyle = o.side;
  ctx.fill();
  const top = depth * 0.45 * press;
  const inset = Math.min(w * 0.05, 14);
  const faceH = h - depth * 0.5;
  roundRect(ctx, inset * 0.5, top, w - inset, faceH, r * 0.85);
  ctx.fillStyle = o.cap;
  ctx.fill();
  // Light falling on a sculpted cap: brighter at the top edge.
  const light = ctx.createLinearGradient(0, top, 0, top + faceH);
  light.addColorStop(0, "rgba(255,255,255,0.14)");
  light.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = light;
  ctx.fill();

  const midY = top + faceH / 2;
  ctx.fillStyle = o.legend;
  ctx.textBaseline = "middle";
  if (label) {
    ctx.font = font(o.fontSize ?? s * 0.44, { family: "Unbounded", weight: o.weight ?? 700 });
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

function textWidth(ctx, str, size, o) {
  ctx.save();
  ctx.font = font(size, o);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

// Types `labels` onto a centred row of caps, one key every `step` seconds.
function typeRow(ctx, labels, cy, size, t, t0, fx, cw, o = {}) {
  const gap = size * 0.14;
  const widths = labels.map((l) => (o.narrow?.(l) ? size * 0.55 : size));
  let total = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
  const fit = Math.min(1, CONTENT / total);
  total *= fit;
  let x = W / 2 - total / 2;
  const step = o.step ?? 0.1;
  labels.forEach((label, i) => {
    const w = widths[i] * fit;
    const at = t0 + i * step;
    fx.key(at);
    const local = REDUCED ? 9 : t - at;
    if (local >= 0) {
      const colors = o.colors?.(i) ?? cw;
      cap(ctx, x + w / 2, cy, w, size * fit, label, {
        ...colors,
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
  text(ctx, "made with npx agent-wrapped", W / 2, H - 120, {
    size: 30, style: "italic", color: cw.ink, alpha: 0.7, align: "center",
  });
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

function buildCards() {
  const cards = [];
  const add = (card) => cards.push(card);
  const digits = (s) => [...s];
  const narrow = (l) => l === "," || l === ":" || l === ".";

  add({
    id: "intro", cw: CW.ultramarine, dur: 6,
    alt: "Your agents have been talking about you.",
    draw(ctx, t, fx, cw) {
      typeRow(ctx, ["h", "e", "y"], 640, 210, t, 0.4, fx, cw, { step: 0.17 });
      const y = text(ctx, "Your agents have been talking about you.", M, 900, {
        family: "Unbounded", weight: 800, size: 78, color: cw.ink, alpha: fade(t, 1.3),
      });
      if (D.range) {
        text(ctx, `Here's what we noticed, ${day(D.range.from)} to ${day(D.range.to)}.`, M, y + 20, {
          size: 48, style: "italic", color: cw.ink, alpha: fade(t, 2.1),
        });
      }
    },
  });

  add({
    id: "prompts", cw: CW.cherry, dur: 6.5,
    alt: `You asked your agents for something ${num(D.prompts)} times, over ${num(D.activeDays)} days.`,
    draw(ctx, t, fx, cw) {
      text(ctx, "You asked us for something", M, 470, { size: 54, style: "italic", color: cw.ink, alpha: fade(t, 0.2) });
      typeRow(ctx, digits(num(D.prompts)), 820, 168, t, 0.7, fx, cw, { narrow, step: 0.13 });
      text(ctx, `times, over ${num(D.activeDays)} days.`, M, 1010, {
        family: "Unbounded", weight: 800, size: 72, color: cw.ink, alpha: fade(t, 1.8),
      });
    },
  });

  if (D.topTypo) {
    const tt = D.topTypo;
    add({
      id: "top-typo", cw: CW.butter, dur: 6.5,
      alt: `You typed ${tt.spelling} ${num(tt.count)} times. We read it as ${tt.word}.`,
      draw(ctx, t, fx, cw) {
        typeRow(ctx, digits(tt.spelling), 700, 220, t, 0.4, fx, cw, { step: 0.16 });
        const y = text(ctx, `You typed ${tt.spelling} ${num(tt.count)} times.`, M, 940, {
          family: "Unbounded", weight: 800, size: 76, color: cw.ink, alpha: fade(t, 1.3),
        });
        text(ctx, `We read it as “${tt.word}”. Every single time.`, M, y + 16, {
          size: 50, style: "italic", color: cw.ink, alpha: fade(t, 2.2),
        });
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
      id: "spellings", cw: CW.lilac, dur: settle + 4,
      alt: `There are ${sp.spellings.length + 1} ways to spell ${sp.word}. You used all of them.`,
      draw(ctx, t, fx, cw) {
        text(ctx, `How you spell ${sp.word}`, M, 300, { family: "Unbounded", weight: 800, size: 70, color: cw.ink });
        const i = REDUCED ? list.length : Math.floor((t - t0) / each);
        const done = i >= list.length;
        list.forEach((_, k) => fx.key(t0 + k * each));
        fx.ding(settle);
        const word = done ? sp.word : list[clamp(i, 0, list.length - 1)];
        const local = done ? t - settle : (t - t0) % each;
        const size = Math.min(150, (CONTENT / word.length) * 0.86);
        const colors = done ? cw : HIT;
        if (t >= t0 || REDUCED) {
          const gap = size * 0.14;
          let x = W / 2 - (word.length * size + (word.length - 1) * gap) / 2;
          for (const ch of word) {
            cap(ctx, x + size / 2, 820, size, size, ch, {
              ...colors, press: local < 0.1 && !REDUCED ? 1 - local / 0.1 : 0,
            });
            x += size + gap;
          }
        }
        if (done) {
          const y = text(ctx, `${sp.spellings.length + 1} ways to spell it.`, M, 1040, {
            family: "Unbounded", weight: 800, size: 72, color: cw.ink, alpha: fade(t, settle + 0.2),
          });
          text(ctx, "We know, because you used all of them.", M, y + 16, {
            size: 50, style: "italic", color: cw.ink, alpha: fade(t, settle + 1),
          });
        }
      },
    });
  }

  if (D.slip) {
    const s = D.slip;
    const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
    const taps = [1.4, 1.75, 2.1, 2.45];
    add({
      id: "slip", cw: CW.mint, dur: 7,
      alt: `You meant ${s.meant.toUpperCase()} and hit ${s.hit.toUpperCase()}, ${num(s.count)} times.`,
      draw(ctx, t, fx, cw) {
        text(ctx, `You meant ${s.meant.toUpperCase()}.\nYou hit ${s.hit.toUpperCase()}.`, M, 300, {
          family: "Unbounded", weight: 800, size: 84, color: cw.ink,
        });
        const size = 82;
        const gap = 10;
        taps.forEach((at) => fx.key(at));
        const sinceTap = Math.min(...taps.map((at) => (t >= at ? t - at : 9)));
        rows.forEach((row, r) => {
          const rowW = row.length * size + (row.length - 1) * gap;
          const x0 = W / 2 - rowW / 2 + r * size * 0.3;
          [...row].forEach((ch, c) => {
            const cx = x0 + c * (size + gap) + size / 2;
            const cy = 820 + r * (size + gap + 8);
            const isHit = ch === s.hit && t >= taps[0];
            const isMeant = ch === s.meant;
            if (isMeant && t >= 0.8) {
              ctx.save();
              ctx.strokeStyle = CW.butter.plate;
              ctx.lineWidth = 7;
              ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 5) ** 2;
              roundRect(ctx, cx - size / 2 - 10, cy - size / 2 - 10, size + 20, size + 26, 22);
              ctx.stroke();
              ctx.restore();
            }
            cap(ctx, cx, cy, size, size, ch, {
              ...(isHit ? HIT : cw),
              fontSize: 34,
              press: isHit && sinceTap < 0.14 ? 1 - sinceTap / 0.14 : 0,
            });
          });
        });
        text(ctx, `${num(s.count)} times. They're neighbours, so we let it slide.`, M, 1160, {
          size: 50, style: "italic", color: cw.ink, alpha: fade(t, 2.8),
        });
      },
    });
  }

  if (D.topPrompts.length) {
    const top = D.topPrompts;
    const most = top[0].count;
    add({
      id: "top-prompts", cw: CW.ultramarine, dur: 6.5,
      alt: `Your favourite things to say to us: ${top.map((p) => `${p.text}, ${p.count} times`).join("; ")}.`,
      draw(ctx, t, fx, cw) {
        text(ctx, "Your favourite things to say to us", M, 300, { family: "Unbounded", weight: 800, size: 70, color: cw.ink });
        top.forEach((p, i) => {
          const at = 0.6 + i * 0.35;
          fx.key(at);
          const local = REDUCED ? 9 : t - at;
          if (local < 0) return;
          const label = { text: `“${p.text}”`, size: 46, family: "Unbounded", weight: 700 };
          const right = { text: `${p.count}×`, size: 46, weight: 600 };
          const least = textWidth(ctx, label.text, 46, label) + textWidth(ctx, right.text, 46, right) + 140;
          const w = Math.min(CONTENT, least + (CONTENT - least) * (p.count / most) * easeOut(local / 0.5));
          cap(ctx, M + w / 2, 760 + i * 190, w, 140, "", {
            ...cw, left: true, lines: [label], right, press: local < 0.14 ? 1 - local / 0.14 : 0,
          });
        });
        text(ctx, "Short, clear and a little bossy. We like it.", M, 760 + top.length * 190, {
          size: 50, style: "italic", color: cw.ink, alpha: fade(t, 0.6 + top.length * 0.35 + 0.5),
        });
      },
    });
  }

  if (D.catchphrase) {
    const c = D.catchphrase;
    add({
      id: "catchphrase", cw: CW.cherry, dur: 6,
      alt: `Your catchphrase: ${c.text}. You said it in ${c.sessions} different sessions.`,
      draw(ctx, t, fx, cw) {
        text(ctx, "Your catchphrase", M, 420, { size: 54, style: "italic", color: cw.ink });
        fx.ding(0.5);
        const y = text(ctx, `“${c.text}”`, M, 560, {
          size: 150, weight: 600, style: "italic", color: cw.cap, lh: 1.02, alpha: fade(t, 0.5, 0.7),
        });
        text(ctx, `You said it in ${num(c.sessions)} different sessions. It's basically your motto now.`, M, y + 40, {
          size: 50, style: "italic", color: cw.ink, alpha: fade(t, 1.6),
        });
      },
    });
  }

  if (D.night) {
    const n = D.night;
    add({
      id: "night", cw: CW.night, dur: 6.5,
      alt: `Your latest prompt after midnight was at ${n.latest}. ${num(n.prompts)} prompts after midnight.`,
      draw(ctx, t, fx, cw) {
        text(ctx, "Your latest prompt after midnight", M, 420, { size: 54, style: "italic", color: cw.ink });
        typeRow(ctx, digits(n.latest), 800, 190, t, 0.6, fx, cw, { narrow, step: 0.15 });
        text(ctx, `${num(n.prompts)} prompts after 12 a.m. We were up too.`, M, 1000, {
          family: "Unbounded", weight: 800, size: 68, color: cw.ink, alpha: fade(t, 1.8),
        });
      },
    });
  }

  if (D.streak) {
    const s = D.streak;
    const shown = Math.min(s.days, 42);
    const step = clamp(2.4 / shown, 0.04, 0.12);
    add({
      id: "streak", cw: CW.mint, dur: 4 + shown * step,
      alt: `${s.days} days in a row, ${day(s.from)} to ${day(s.to)}.`,
      draw(ctx, t, fx, cw) {
        const size = 104;
        const gap = 20;
        const x0 = W / 2 - (7 * size + 6 * gap) / 2;
        for (let i = 0; i < shown; i++) {
          const at = 0.4 + i * step;
          fx.key(at);
          const local = REDUCED ? 9 : t - at;
          const cx = x0 + (i % 7) * (size + gap) + size / 2;
          const cy = 330 + Math.floor(i / 7) * (size + gap + 10);
          const lit = local >= 0;
          cap(ctx, cx, cy, size, size, lit ? String(i + 1) : "", {
            ...(lit ? cw : { cap: "rgba(255,255,255,0.12)", side: "rgba(0,0,0,0.12)", legend: cw.legend }),
            fontSize: 34,
            press: lit && local < 0.12 ? 1 - local / 0.12 : 0,
          });
        }
        const end = 0.4 + shown * step;
        const y0 = 330 + Math.ceil(shown / 7) * (size + gap + 10) + 60;
        const y = text(ctx, `${s.days} days in a row.`, M, y0, {
          family: "Unbounded", weight: 800, size: 84, color: cw.ink, alpha: fade(t, end),
        });
        text(ctx, `${day(s.from)} to ${day(s.to)}. Not one day off.`, M, y + 10, {
          size: 50, style: "italic", color: cw.ink, alpha: fade(t, end + 0.7),
        });
      },
    });
  }

  if (D.agents) {
    const a = D.agents;
    add({
      id: "agents", cw: CW.butter, dur: 6.5,
      alt: `${num(a.hours)} hours of agent work. Codex ${Math.round(a.codex * 100)} percent, Claude ${Math.round(a.claude * 100)} percent.`,
      draw(ctx, t, fx, cw) {
        const y = text(ctx, `${num(a.hours)} hours of work, split between two of us.`, M, 300, {
          family: "Unbounded", weight: 800, size: 72, color: cw.ink,
        });
        const parts = [["Codex", a.codex], ["Claude", a.claude]].filter(([, v]) => v > 0);
        parts.forEach(([name, share], i) => {
          const at = 0.7 + i * 0.4;
          fx.key(at);
          const local = REDUCED ? 9 : t - at;
          if (local < 0) return;
          const label = { text: `${name} ${Math.round(share * 100)}%`, size: 52, family: "Unbounded", weight: 700 };
          const least = textWidth(ctx, label.text, 52, label) + 100;
          const w = Math.max(least, CONTENT * share) * easeOut(local / 0.6);
          cap(ctx, M + w / 2, y + 200 + i * 230, w, 170, "", {
            ...cw, left: true, lines: [label], press: local < 0.14 ? 1 - local / 0.14 : 0,
          });
        });
        if (a.bothDays > 0) {
          text(ctx, `Some days you needed both of us. ${num(a.bothDays)} of them, to be exact.`, M, y + 640, {
            size: 50, style: "italic", color: cw.ink, alpha: fade(t, 2),
          });
        }
      },
    });
  }

  if (D.money) {
    const m = D.money;
    add({
      id: "money", cw: CW.ultramarine, dur: 7,
      alt: `At least ${num(m.atLeastUsd)} US dollars of agent work at public API prices.`,
      draw(ctx, t, fx, cw) {
        text(ctx, "Our work, at public API prices", M, 420, { size: 54, style: "italic", color: cw.ink });
        typeRow(ctx, digits(`$${num(m.atLeastUsd)}`), 780, 150, t, 0.6, fx, cw, { narrow, step: 0.12 });
        const y = text(ctx, "At least. We priced what we could count exactly, and the rest at the cheapest rate.", M, 960, {
          size: 50, style: "italic", color: cw.ink, alpha: fade(t, 1.8),
        });
        text(ctx, `Public prices on ${day(m.pricesAsOf)}. Your plan probably cost a lot less.`, M, y + 20, {
          size: 34, color: cw.ink, alpha: 0.75 * fade(t, 2.6),
        });
      },
    });
  }

  const p = D.personality;
  add({
    id: "personality", cw: CW.lilac, dur: 8,
    alt: `You are ${p.name}. ${p.line}`,
    draw(ctx, t, fx, cw) {
      text(ctx, "So, who are you?", M, 300, { size: 54, style: "italic", color: cw.ink });
      const reveal = 2.2;
      [0.5, 0.8, 1.05, 1.25, 1.42, 1.56, 1.68, 1.78].forEach((at) => fx.key(at));
      fx.ding(reveal);
      const revealed = t >= reveal || REDUCED;
      const wobble = revealed ? 0 : Math.sin(t * 40) * 0.04;
      cap(ctx, W / 2, 620, 280, 280, revealed ? initials(p.name) : "?", {
        ...cw,
        fontSize: 110,
        scale: revealed ? 0.9 + 0.1 * easeBack((t - reveal) / 0.3) : 1 + wobble,
        press: !revealed && (t * 6) % 1 < 0.3 ? 1 : 0,
      });
      if (!revealed) return;
      const y = text(ctx, p.name, M, 860, {
        family: "Unbounded", weight: 900, size: 104, color: cw.ink, lh: 1.05, alpha: fade(t, reveal, 0.3),
      });
      const y2 = text(ctx, p.line, M, y + 40, { size: 52, style: "italic", color: cw.ink, alpha: fade(t, reveal + 0.8) });
      if (p.traits.length) {
        const traits = p.traits.map((name) => name.replace(/^The /, "the "));
        text(ctx, `With a bit of ${traits.join(" and ")}.`, M, y2 + 30, {
          size: 40, color: cw.ink, alpha: 0.8 * fade(t, reveal + 1.6),
        });
      }
    },
  });

  const words = D.letter.text.split(/\s+/).length;
  add({
    id: "letter", cw: CW.night, dur: Math.max(10, words * 0.28 + 3),
    alt: `A note from your agents: ${D.letter.text}`,
    draw(ctx, t, fx, cw) {
      const head = text(ctx, "A note from your agents", M, 200, { family: "Unbounded", weight: 800, size: 60, color: cw.ink });
      const body = { size: 44, color: "#1E2160", max: CONTENT - 60, lh: 1.42 };
      const top = head + 40;
      const height = text(ctx, D.letter.text, 0, 0, { ...body, measure: true }) + 100;
      const paper = { cap: CW.ultramarine.cap, side: CW.ultramarine.side, legend: "" };
      cap(ctx, W / 2, top + height / 2, CONTENT + 40, height, "", {
        ...paper, scale: REDUCED ? 1 : 0.96 + 0.04 * easeOut(t / 0.5),
      });
      // Words appear at reading pace.
      const shown = REDUCED ? words : Math.floor(clamp((t - 0.6) / 0.22, 0, words));
      const visible = D.letter.text.split(/(\s+)/).reduce(
        (acc, part) => {
          if (/\S/.test(part)) acc.n++;
          if (acc.n <= shown) acc.s += part;
          return acc;
        },
        { n: 0, s: "" },
      ).s;
      text(ctx, visible, M + 30, top + 30, body);
    },
  });

  add({
    id: "summary", cw: CW.ultramarine, dur: 8,
    alt: `Summary: ${p.name}. ${num(D.prompts)} prompts.`,
    draw(ctx, t, fx, cw) {
      text(ctx, "My year with AI agents", M, 200, { size: 50, style: "italic", color: cw.ink });
      const y = text(ctx, p.name, M, 290, { family: "Unbounded", weight: 900, size: 92, color: cw.ink, lh: 1.05 });
      const tiles = [
        [num(D.prompts), "prompts"],
        D.agents ? [num(D.agents.hours), "hours of agent work"] : null,
        D.topTypo ? [`${D.topTypo.spelling} ×${num(D.topTypo.count)}`, "my favourite typo"] : null,
        D.night ? [D.night.latest, "latest prompt after midnight"] : D.streak ? [`${D.streak.days} days`, "longest streak"] : null,
      ].filter(Boolean);
      const tw = (CONTENT - 30) / 2;
      const th = 330;
      tiles.forEach(([big, small], i) => {
        const at = 0.4 + i * 0.25;
        fx.key(at);
        const local = REDUCED ? 9 : t - at;
        if (local < 0) return;
        const cx = M + (i % 2) * (tw + 30) + tw / 2;
        const cy = y + 120 + Math.floor(i / 2) * (th + 40) + th / 2;
        const bigFont = { family: "Unbounded", weight: 800 };
        const fit = Math.min(64, (64 * (tw - 80)) / textWidth(ctx, big, 64, bigFont));
        ctx.save();
        ctx.font = font(36);
        const smallLines = wrap(ctx, small, tw - 80);
        ctx.restore();
        cap(ctx, cx, cy, tw, th, "", {
          ...cw,
          left: true,
          lines: [{ text: big, size: fit, ...bigFont }, ...smallLines.map((l) => ({ text: l, size: 36, alpha: 0.85 }))],
          scale: 0.85 + 0.15 * easeBack(local / 0.25),
          press: local < 0.14 ? 1 - local / 0.14 : 0,
        });
      });
    },
  });

  return cards;
}

// ---------------------------------------------------------------- player

const cards = buildCards();
const stage = document.getElementById("stage");
const ctx = stage.getContext("2d");
const bars = document.getElementById("bars");
const live = document.getElementById("live");
bars.innerHTML = cards.map(() => "<span><i></i></span>").join("");

function paint(target, card, t, fx) {
  const c = target.getContext("2d");
  c.fillStyle = card.cw.plate;
  c.fillRect(0, 0, W, H);
  c.save();
  c.translate(0, card.offset ?? 0);
  card.draw(c, t, fx, card.cw);
  c.restore();
  watermark(c, card.cw);
}

// Centres each card's finished content in the space above the watermark,
// by finding the first and last rows that differ from the background.
function centreCards() {
  const scale = 0.25;
  const probe = document.createElement("canvas");
  probe.width = W * scale;
  probe.height = H * scale;
  const c = probe.getContext("2d", { willReadFrequently: true });
  for (const card of cards) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = card.cw.plate;
    c.fillRect(0, 0, probe.width, probe.height);
    c.setTransform(scale, 0, 0, scale, 0, 0);
    card.draw(c, card.dur, SILENT, card.cw);
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
    if (first < 0) continue;
    const top = first / scale;
    const bottom = last / scale;
    const space = { top: 140, bottom: H - 220 };
    const offset = (space.top + space.bottom) / 2 - (top + bottom) / 2;
    card.offset = Math.max(space.top - top, Math.min(offset, space.bottom - bottom));
  }
}

function setTheme(cw) {
  const s = document.documentElement.style;
  s.setProperty("--plate", cw.plate);
  s.setProperty("--ink", cw.ink);
  s.setProperty("--cap", cw.cap);
  s.setProperty("--legend", cw.legend);
  s.setProperty("--side", cw.side);
}

const state = { index: 0, started: 0, playing: false, holdPaused: false, pausedAt: 0, prevT: 0, mode: "player" };

function show(index) {
  state.index = clamp(index, 0, cards.length - 1);
  state.started = performance.now();
  state.prevT = -1;
  setTheme(cards[state.index].cw);
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
    [...bars.children].forEach((b, i) => {
      b.firstChild.style.width = `${i < state.index ? 100 : i > state.index ? 0 : clamp(t / card.dur) * 100}%`;
    });
    if (state.playing && !state.holdPaused && t >= card.dur) {
      if (state.index === cards.length - 1) openShare();
      else show(state.index + 1);
    }
  }
  requestAnimationFrame(tick);
}

document.getElementById("play").addEventListener("click", () => {
  Sound.init();
  document.getElementById("start").remove();
  state.playing = true;
  show(0);
});

// Tap right half: next. Tap left: back. Press and hold: pause.
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
  if (state.mode !== "player" || !state.playing) return;
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

// ---------------------------------------------------------------- sharing

const share = document.getElementById("share");
const status = document.getElementById("status");
const included = cards.map(() => true);

function finalFrame(card) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  paint(c, card, card.dur, SILENT);
  return c;
}

function openShare() {
  state.mode = "share";
  setTheme(CW.ultramarine);
  document.getElementById("player").style.display = "none";
  share.classList.add("open");
  const list = document.getElementById("cards");
  list.innerHTML = "";
  cards.forEach((card, i) => {
    const item = document.createElement("div");
    item.className = "card";
    const img = document.createElement("img");
    img.src = finalFrame(card).toDataURL("image/png");
    img.alt = card.alt;
    const toggle = document.createElement("button");
    const render = () => {
      item.classList.toggle("hidden", !included[i]);
      toggle.textContent = included[i] ? "Hide this card" : "Show this card";
      toggle.setAttribute("aria-pressed", String(included[i]));
    };
    toggle.addEventListener("click", () => {
      included[i] = !included[i];
      render();
    });
    render();
    item.append(img, toggle);
    list.append(item);
  });
  share.querySelector("h1").focus?.();
}

function chosen() {
  return cards.filter((_, i) => included[i]);
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

document.getElementById("save-images").addEventListener("click", async () => {
  const list = chosen();
  if (!list.length) {
    status.textContent = "Show at least one card to save it.";
    return;
  }
  for (const [i, card] of list.entries()) {
    const blob = await new Promise((r) => finalFrame(card).toBlob(r, "image/png"));
    download(blob, `agent-wrapped-${String(i + 1).padStart(2, "0")}-${card.id}.png`);
    await new Promise((r) => setTimeout(r, 250));
  }
  status.textContent = `Saved ${list.length} ${list.length === 1 ? "image" : "images"} to your Downloads folder.`;
});

// Plays the chosen cards in real time onto a hidden canvas and records it.
document.getElementById("save-video").addEventListener("click", async (e) => {
  const list = chosen();
  if (!list.length) {
    status.textContent = "Show at least one card to save it.";
    return;
  }
  if (typeof MediaRecorder === "undefined") {
    status.textContent = "This browser can't record video. Try Chrome, Arc or Safari.";
    return;
  }
  const button = e.currentTarget;
  button.disabled = true;
  Sound.init();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
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

  const total = list.reduce((s, c) => s + c.dur, 0);
  let done = 0;
  for (const card of list) {
    await new Promise((resolve) => {
      const start = performance.now();
      let prev = -1;
      const frame = (now) => {
        const t = (now - start) / 1000;
        paint(canvas, card, Math.min(t, card.dur), effects(prev, t, true));
        prev = t;
        status.textContent = `Recording your video, ${Math.floor(((done + Math.min(t, card.dur)) / total) * 100)}%. Keep this tab open.`;
        if (t >= card.dur) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    done += card.dur;
  }
  recorder.stop();
  await finished;
  const ext = type.startsWith("video/mp4") ? "mp4" : "webm";
  download(new Blob(chunks, { type }), `agent-wrapped.${ext}`);
  status.textContent = `Saved your video to your Downloads folder as agent-wrapped.${ext}.`;
  button.disabled = false;
});

document.getElementById("replay").addEventListener("click", () => {
  share.classList.remove("open");
  document.getElementById("player").style.display = "";
  state.mode = "player";
  state.playing = true;
  show(0);
});

// Draw the first card once fonts are ready, so nothing flashes in a fallback font.
Promise.all([
  document.fonts.load('800 80px "Unbounded"'),
  document.fonts.load('400 40px "Newsreader"'),
  document.fonts.load('italic 400 40px "Newsreader"'),
]).finally(() => {
  centreCards();
  setTheme(cards[0].cw);
  requestAnimationFrame(tick);
});
