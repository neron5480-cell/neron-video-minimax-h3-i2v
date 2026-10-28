// ============================================================================
//  Neron Stage — математика площадки (копия stage_core.py для превью)
//  Stage math (mirror of stage_core.py so the preview matches the output).
//  Меняешь тут — поменяй и там. Change here → change there too.
// ============================================================================

export const ANGLE_KEYS = ["tp", "ty", "tr", "hp", "hy", "lsp", "lsr", "le", "rsp", "rsr", "re",
    "lhp", "lhr", "lk", "rhp", "rhr", "rk"];
const WALK_SPEED = { walk: 1.25, run: 3.0 };
const STRIDE = { walk: 1.35, run: 2.4 };
const BLEND_T = 0.35;
export const FPS = 24;

export const LIMBS = [[1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10],
    [1, 11], [11, 12], [12, 13], [1, 0], [0, 14], [14, 16], [0, 15], [15, 17]];
export const COLORS = [[255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0], [85, 255, 0],
    [0, 255, 0], [0, 255, 85], [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255],
    [0, 0, 255], [85, 0, 255], [170, 0, 255], [255, 0, 255], [255, 0, 170], [255, 0, 85]];

let POSES = null;
export function setPoses(p) { POSES = p; }
export function poses() { return POSES; }

export function framesFor(seconds, fps = FPS) {
    const n = Math.max(1, Math.round((Number(seconds) * fps - 5) / 17));
    return 17 * n + 5;
}

const rad = (d) => d * Math.PI / 180;
function rx(a, v) { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; }
function ry(a, v) { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; }
function rz(a, v) { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; }
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
function chain(v, ops) {
    for (let i = ops.length - 1; i >= 0; i--) {
        const [ax, an] = ops[i];
        v = ax === "x" ? rx(an, v) : ax === "y" ? ry(an, v) : rz(an, v);
    }
    return v;
}

export function fk(ang, height = 1.7) {
    const b = POSES.body;
    const k = height / b.height;
    const g = {};
    for (const key of ANGLE_KEYS) g[key] = rad(Number(ang[key] || 0));
    const torso = [["y", g.ty], ["x", g.tp], ["z", g.tr]];
    const head = torso.concat([["y", g.hy], ["x", g.hp]]);
    const P = [0, 0, 0];
    const neck = add(P, chain([0, b.pelvis_to_neck * k, 0], torso));
    const headC = add(neck, chain([0, b.neck_to_head * k, 0], torso));
    const pts = new Array(18);
    pts[1] = neck;
    pts[0] = add(headC, chain([0, -0.01 * k, 0.10 * k], head));
    pts[15] = add(headC, chain([0.035 * k, 0.03 * k, 0.085 * k], head));
    pts[14] = add(headC, chain([-0.035 * k, 0.03 * k, 0.085 * k], head));
    pts[17] = add(headC, chain([0.075 * k, 0, 0], head));
    pts[16] = add(headC, chain([-0.075 * k, 0, 0], head));
    const down = [0, -1, 0];
    for (const [side, sh, el, wr, sp, sr, ek] of [[1, 5, 6, 7, "lsp", "lsr", "le"], [-1, 2, 3, 4, "rsp", "rsr", "re"]]) {
        const shoulder = add(neck, chain([side * b.shoulder_half * k, -0.02 * k, 0], torso));
        const upper = torso.concat([["x", -g[sp]], ["z", side * g[sr]]]);
        const elbow = add(shoulder, mul(chain(down, upper), b.upper_arm * k));
        const wrist = add(elbow, mul(chain(down, upper.concat([["x", -g[ek]]])), b.forearm * k));
        pts[sh] = shoulder; pts[el] = elbow; pts[wr] = wrist;
    }
    for (const [side, hp, kn, an, pp, pr, kk] of [[1, 11, 12, 13, "lhp", "lhr", "lk"], [-1, 8, 9, 10, "rhp", "rhr", "rk"]]) {
        const hip = add(P, [side * b.hip_half * k, 0, 0]);
        const thigh = [["x", -g[pp]], ["z", side * g[pr]]];
        const knee = add(hip, mul(chain(down, thigh), b.thigh * k));
        const ankle = add(knee, mul(chain(down, thigh.concat([["x", g[kk]]])), b.shin * k));
        pts[hp] = hip; pts[kn] = knee; pts[an] = ankle;
    }
    const floor = Math.min(pts[10][1] - b.ankle_h * k, pts[13][1] - b.ankle_h * k, pts[9][1] - 0.05 * k, pts[12][1] - 0.05 * k);
    return pts.map((p) => [p[0], p[1] - floor, p[2]]);
}

// ---------------------------------------------------------------- план движения
export function poseDef(name) { return POSES.poses[name] || POSES.poses.stand; }
function lerpAng(a, b, t) { const o = {}; for (const k of ANGLE_KEYS) o[k] = (a[k] || 0) * (1 - t) + (b[k] || 0) * t; return o; }
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function cycle(pd, u, period) {
    const a = pd.a || {};
    if (!pd.b) return Object.assign({}, a);
    const w = (1 - Math.cos(2 * Math.PI * u / Math.max(0.05, period))) / 2;
    return lerpAng(a, pd.b, w);
}
const mid = (pd) => lerpAng(pd.a || {}, pd.b || pd.a || {}, 0.5);

export function targetAngles(point, u = 0) {
    const pd = poseDef(point.pose || "stand");
    const ang = cycle(pd, u, pd.cycle || 1.0);
    for (const [k, v] of Object.entries(point.adj || {})) if (ANGLE_KEYS.includes(k)) ang[k] = (ang[k] || 0) + Number(v);
    const o = {}; for (const k of ANGLE_KEYS) o[k] = ang[k] || 0;
    return o;
}

export function holdOf(p) {
    if (p.hold != null && Number(p.hold) > 0) return Number(p.hold);
    return ((p.pose || "stand") === "stand" && !String(p.text || "").trim()) ? 0.6 : 1.6;
}

function yawTo(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    if (Math.abs(dx) + Math.abs(dz) < 1e-6) return null;
    return Math.atan2(dx, dz) * 180 / Math.PI;
}
function lerpYaw(a, b, t) { const d = ((((b - a + 180) % 360) + 360) % 360) - 180; return a + d * t; }

export function plan(state) {
    let pts = (state.points || []).filter((p) => p && typeof p === "object");
    const seconds = Number(state.seconds || 5);
    if (!pts.length) pts = [{ x: 0, z: -3, pose: "stand" }];
    const raw = [];
    pts.forEach((p, i) => {
        raw.push({ kind: "hold", i, d: holdOf(p) });
        if (i + 1 < pts.length) {
            const q = pts[i + 1];
            const dist = Math.hypot(q.x - p.x, q.z - p.z);
            const mv = WALK_SPEED[q.move] ? q.move : "walk";
            raw.push({ kind: "move", i, d: dist / WALK_SPEED[mv], dist, move: mv });
        }
    });
    const total = raw.reduce((s, x) => s + x.d, 0) || 1;
    const k = seconds / total;
    let t = 0;
    for (const s of raw) { s.t0 = t; s.d *= k; t += s.d; s.t1 = t; }
    raw[raw.length - 1].t1 = seconds;
    const yaws = pts.map((p, i) => {
        if (p.yaw != null) return Number(p.yaw);
        const yIn = i > 0 ? yawTo(pts[i - 1], p) : null;
        const yOut = i + 1 < pts.length ? yawTo(p, pts[i + 1]) : null;
        const y = yIn != null ? yIn : yOut;
        return y != null ? y : 180;
    });
    return { segments: raw, points: pts, yaws, speedK: k, seconds };
}

export function sample(pl, t) {
    const { segments: segs, points: pts, yaws } = pl;
    let idx = segs.length - 1;
    for (let j = 0; j < segs.length; j++) if (t < segs[j].t1) { idx = j; break; }
    const seg = segs[idx];
    const i = seg.i, p = pts[i];
    const u = Math.max(0, t - seg.t0);
    const D = Math.max(1e-6, seg.t1 - seg.t0);
    if (seg.kind === "move") {
        const q = pts[i + 1];
        const f = Math.min(1, u / D);
        const phase = (seg.dist * f) / STRIDE[seg.move];
        return { x: p.x + (q.x - p.x) * f, z: p.z + (q.z - p.z) * f, yaw: yawTo(p, q), ang: cycle(poseDef(seg.move), phase, 1.0), seg: idx };
    }
    const tgt = targetAngles(p, u);
    let yaw = yaws[i];
    const prev = idx > 0 && segs[idx - 1].kind === "move" ? segs[idx - 1] : null;
    const next = idx + 1 < segs.length && segs[idx + 1].kind === "move" ? segs[idx + 1] : null;
    const tau = Math.min(BLEND_T, D / 2);
    let ang = tgt;
    if (prev && u < tau) ang = lerpAng(mid(poseDef(prev.move)), tgt, smooth(u / tau));
    if (next) {
        const left = D - u;
        if (left < tau) {
            const w = smooth(1 - left / tau);
            ang = lerpAng(tgt, mid(poseDef(next.move)), w);
            const yOut = yawTo(p, pts[i + 1]);
            if (yOut != null) yaw = lerpYaw(yaw, yOut, w);
        }
    }
    return { x: p.x, z: p.z, yaw, ang, seg: idx };
}

export function placeBody(local, x, z, yawDeg) {
    const a = rad(yawDeg);
    return local.map((q) => add(ry(a, q), [x, 0, z]));
}

export function worldPoints(pl, t, height = 1.7) {
    const s = sample(pl, t);
    return placeBody(fk(s.ang, height), s.x, s.z, s.yaw);
}
