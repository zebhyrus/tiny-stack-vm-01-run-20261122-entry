import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
// Operand-length lookup: one table read per step replaces the if/else
// range chain in the dispatch loop. 255 = invalid opcode (trap 5).
const OLEN = new Uint8Array(256).fill(255);
for (const o of [0, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 33, 34, 52, 64, 65, 80, 81, 82, 83]) OLEN[o] = 0;
OLEN[1] = 1; OLEN[2] = 4;
for (let o = 48; o <= 51; o++) OLEN[o] = 2;
function run(p, inp) {
  const s = new Int32Array(256), c = new Int32Array(64), m = new Int32Array(256);
  const out = [];
  let pc = 0, sp = 0, cp = 0, ip = 0, steps = 0;
  while (true) {
    if (steps >= 1000000) return { out, code: 10 };
    if (pc < 0 || pc >= p.length) return { out, code: 9 };
    const op = p[pc];
    const n = OLEN[op];
    if (n === 255) return { out, code: 5 };
    if (pc + 1 + n > p.length) return { out, code: 9 };
    steps++;
    const next = pc + 1 + n;
    let a, b, t;
    switch (op) {
      case 0: return { out, code: 0 };
      case 1:
        if (sp >= 256) return { out, code: 3 };
        t = p[pc + 1]; s[sp++] = t >= 128 ? t - 256 : t; pc = next; break;
      case 2:
        if (sp >= 256) return { out, code: 3 };
        s[sp++] = p[pc + 1] | (p[pc + 2] << 8) | (p[pc + 3] << 16) | (p[pc + 4] << 24); pc = next; break;
      case 3:
        if (sp < 1) return { out, code: 2 };
        sp--; pc = next; break;
      case 4:
        if (sp < 1) return { out, code: 2 };
        if (sp >= 256) return { out, code: 3 };
        s[sp] = s[sp - 1]; sp++; pc = next; break;
      case 5:
        if (sp < 2) return { out, code: 2 };
        t = s[sp - 1]; s[sp - 1] = s[sp - 2]; s[sp - 2] = t; pc = next; break;
      case 6:
        if (sp < 2) return { out, code: 2 };
        if (sp >= 256) return { out, code: 3 };
        s[sp] = s[sp - 2]; sp++; pc = next; break;
      case 7:
        if (sp < 3) return { out, code: 2 };
        a = s[sp - 3]; s[sp - 3] = s[sp - 2]; s[sp - 2] = s[sp - 1]; s[sp - 1] = a; pc = next; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 24: case 25: case 26: case 28: case 29: case 30:
        if (sp < 2) return { out, code: 2 };
        b = s[--sp]; a = s[sp - 1];
        if (op === 16) s[sp - 1] = (a + b) | 0;
        else if (op === 17) s[sp - 1] = (a - b) | 0;
        else if (op === 18) s[sp - 1] = Math.imul(a, b);
        else if (op === 19) {
          if (b === 0) return { out, code: 4 };
          s[sp - 1] = Math.trunc(a / b) | 0;
        } else if (op === 20) {
          if (b === 0) return { out, code: 4 };
          s[sp - 1] = (a % b) | 0;
        } else if (op === 21) {
          if (b === 0) return { out, code: 4 };
          s[sp - 1] = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 22) {
          if (b === 0) return { out, code: 4 };
          s[sp - 1] = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 24) s[sp - 1] = a & b;
        else if (op === 25) s[sp - 1] = a | b;
        else if (op === 26) s[sp - 1] = a ^ b;
        else if (op === 28) s[sp - 1] = a << b;
        else if (op === 29) s[sp - 1] = a >> b;
        else s[sp - 1] = (a >>> b) | 0;
        pc = next; break;
      case 23:
        if (sp < 1) return { out, code: 2 };
        s[sp - 1] = (-s[sp - 1]) | 0; pc = next; break;
      case 27:
        if (sp < 1) return { out, code: 2 };
        s[sp - 1] = ~s[sp - 1]; pc = next; break;
      case 32: case 33: case 34:
        if (sp < 2) return { out, code: 2 };
        b = s[--sp]; a = s[sp - 1];
        if (op === 32) s[sp - 1] = a === b ? 1 : 0;
        else if (op === 33) s[sp - 1] = a < b ? 1 : 0;
        else s[sp - 1] = (a >>> 0) < (b >>> 0) ? 1 : 0;
        pc = next; break;
      case 48:
        t = p[pc + 1] | (p[pc + 2] << 8); if (t >= 32768) t -= 65536;
        pc = next + t; break;
      case 49: case 50:
        if (sp < 1) return { out, code: 2 };
        t = p[pc + 1] | (p[pc + 2] << 8); if (t >= 32768) t -= 65536;
        a = s[--sp]; pc = (op === 49 ? a === 0 : a !== 0) ? next + t : next; break;
      case 51:
        if (cp >= 64) return { out, code: 7 };
        c[cp++] = next; pc = p[pc + 1] | (p[pc + 2] << 8); break;
      case 52:
        if (cp === 0) return { out, code: 8 };
        pc = c[--cp]; break;
      case 64:
        if (sp < 1) return { out, code: 2 };
        a = s[sp - 1]; if (a < 0 || a > 255) return { out, code: 6 };
        s[sp - 1] = m[a]; pc = next; break;
      case 65:
        if (sp < 2) return { out, code: 2 };
        a = s[--sp]; b = s[--sp]; if (a < 0 || a > 255) return { out, code: 6 };
        m[a] = b; pc = next; break;
      case 80:
        if (sp < 1) return { out, code: 2 };
        a = s[--sp]; t = String(a);
        if (out.length + t.length > 65536) return { out, code: 11 };
        for (let i = 0; i < t.length; i++) out.push(t.charCodeAt(i));
        pc = next; break;
      case 81:
        if (sp < 1) return { out, code: 2 };
        if (out.length >= 65536) return { out, code: 11 };
        out.push(s[--sp] & 255); pc = next; break;
      case 82:
        if (sp >= 256) return { out, code: 3 };
        s[sp++] = ip < inp.length ? inp[ip++] : -1; pc = next; break;
      case 83:
        if (sp < 1) return { out, code: 2 };
        return { out, code: s[--sp] & 255 };
    }
  }
}
for (const id of readdirSync(I).sort()) {
  const prog = readFileSync(join(I, id, 'program.bin'));
  let inp;
  try { inp = readFileSync(join(I, id, 'input.bin')); } catch { inp = Buffer.alloc(0); }
  const r = run(prog, inp);
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), Buffer.from(r.out));
  writeFileSync(join(O, id, 'exit.txt'), String(r.code) + '\n');
}
