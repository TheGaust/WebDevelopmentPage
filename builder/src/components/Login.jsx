// src/components/Login.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser, getSessionUser } from "../utils/auth";

function clamp(n, min, max) {
  const v = Number(n);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export default function Login() {
  const nav = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  const leftRef = useRef(null);

  const [awake, setAwake] = useState(false);
  const [focusField, setFocusField] = useState(null); // "user" | "pass" | null

  // privacidade (mostrar senha)
  const [spyIndex, setSpyIndex] = useState(null);
  const [nudge, setNudge] = useState(false);

  // palco p/ posicionamento por índice
  const stageRef = useRef(null);
  const [stageW, setStageW] = useState(0);

  // refs dos inputs (pra “curiosidade” mirar neles)
  const userInputRef = useRef(null);
  const passInputRef = useRef(null);

  // refs das criaturas (pra calcular o centro dos olhos de cada uma)
  const creatureRefs = useRef([]);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const rafRef = useRef(null);

  // olhar por criatura (-1..1)
  const [lookByIdx, setLookByIdx] = useState([]);

  // 6 criaturas
  const CREATURES = useMemo(
    () => [
      { w: 74, h: 390 },
      { w: 84, h: 470 },
      { w: 80, h: 430 },
      { w: 74, h: 360 },
      { w: 78, h: 410 },
      { w: 70, h: 345 },
    ],
    []
  );

  // jitter leve e estável por criatura
  const JITTER = useMemo(() => {
    return CREATURES.map((_, i) => {
      const a = Math.sin((i + 1) * 999) * 10000;
      const frac = a - Math.floor(a);
      return (frac - 0.5) * 22;
    });
  }, [CREATURES]);

  useEffect(() => {
    if (getSessionUser()) nav("/projects", { replace: true });
  }, [nav]);

  useEffect(() => {
    setLookByIdx(CREATURES.map(() => ({ x: 0, y: 0 })));
  }, [CREATURES]);

  useEffect(() => {
    const t = setTimeout(() => setAwake(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // mede largura do palco
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    function update() {
      const r = el.getBoundingClientRect();
      setStageW(Math.max(0, Math.floor(r.width)));
    }

    update();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => update());
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Mostrar senha: todos viram de costas, com chance de 1 "espiar"
  useEffect(() => {
    if (!showPass) {
      setSpyIndex(null);
      setNudge(false);
      return;
    }

    const chance = 0.28;
    if (Math.random() < chance) {
      const idx = Math.floor(Math.random() * CREATURES.length);
      setSpyIndex(idx);

      const t1 = setTimeout(() => setNudge(true), 450);
      const t2 = setTimeout(() => {
        setSpyIndex(null);
        setNudge(false);
      }, 1050);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      setSpyIndex(null);
      setNudge(false);
    }
  }, [showPass, CREATURES.length]);

  // Quem cutuca (vizinho do espião)
  const pokerIndex = useMemo(() => {
    if (spyIndex === null) return null;
    if (spyIndex > 0) return spyIndex - 1;
    if (CREATURES.length > 1) return 1;
    return null;
  }, [spyIndex, CREATURES.length]);

  const updateLooks = () => {
    const m = mouseRef.current;

    let focusPoint = null;
    if (!showPass && focusField) {
      const node = focusField === "user" ? userInputRef.current : passInputRef.current;
      if (node) {
        const r = node.getBoundingClientRect();
        focusPoint = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }

    const target = focusPoint
      ? { x: m.x * 0.6 + focusPoint.x * 0.4, y: m.y * 0.6 + focusPoint.y * 0.4 }
      : { x: m.x, y: m.y };

    const RANGE_X = 160;
    const RANGE_Y = 140;

    const next = CREATURES.map((c, idx) => {
      const node = creatureRefs.current[idx];
      if (!node) return { x: 0, y: 0 };

      const r = node.getBoundingClientRect();

      const eyeCenterX = r.left + r.width / 2;
      const eyeCenterY = r.top + 30;

      const dx = target.x - eyeCenterX;
      const dy = target.y - eyeCenterY;

      return { x: clamp(dx / RANGE_X, -1, 1), y: clamp(dy / RANGE_Y, -1, 1) };
    });

    setLookByIdx(next);
  };

  useEffect(() => {
    function onMove(e) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateLooks();
      });
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPass, focusField, CREATURES]);

  useEffect(() => {
    updateLooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awake, focusField, showPass, stageW]);

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    try {
      const u = user.trim();
      if (!u) return alert("Digite um nome de usuário.");

      if (mode === "register") {
        const res = await registerUser(u, pass);
        if (!res.ok) return alert(res.error || "Falha ao cadastrar.");
        nav("/projects");
      } else {
        const res = await loginUser(u, pass);
        if (!res.ok) return alert(res.error || "Falha ao entrar.");
        nav("/projects");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 overflow-x-hidden relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(1100px 520px at 20% 100%, rgba(15,23,42,0.10), transparent 62%),
            radial-gradient(1000px 520px at 80% 100%, rgba(15,23,42,0.08), transparent 64%),
            linear-gradient(to top, rgba(15,23,42,0.07), transparent 58%)
          `,
        }}
      />

      <div className="relative z-10 min-h-screen w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2">
        {/* ESQUERDA (criaturas) */}
        <div ref={leftRef} className="relative px-6 pt-10 lg:pt-14 overflow-visible">
          <div className="max-w-xl">
            <div className="text-slate-600 text-sm mb-1">Bem-vindo ao PageBuilder</div>
            <div className="text-slate-900 text-2xl font-semibold flex items-center gap-2">
              Eles estão de olho em você <span className="opacity-80">👀</span>
            </div>
          </div>

          <div
            className="absolute left-0 right-0 bottom-0 h-36 pointer-events-none"
            style={{ background: "linear-gradient(to top, rgba(15,23,42,0.03), transparent 78%)" }}
          />

          <div
            ref={stageRef}
            className="absolute pointer-events-none"
            style={{ bottom: -95, left: 0, right: 0, height: 620, overflow: "visible" }}
          >
            {CREATURES.map((c, idx) => {
              const isPrivacy = showPass;
              const isSpy = isPrivacy && spyIndex === idx;
              const turnedBack = isPrivacy && !isSpy;

              const l = lookByIdx[idx] || { x: 0, y: 0 };
              let vx = clamp(l.x, -1, 1);
              let vy = clamp(l.y, -1, 1);

              const mag = Math.hypot(vx, vy);
              if (mag > 1) {
                vx /= mag;
                vy /= mag;
              }

              const MAX_SHIFT = 3.6;
              const px = vx * MAX_SHIFT;
              const py = vy * MAX_SHIFT;

              const curiousAllowed = !!focusField && !isPrivacy;
              const t = curiousAllowed ? 1 : 0;

              const spread = CREATURES.length > 1 ? idx / (CREATURES.length - 1) : 1;
              const effort = 1 + (1 - spread) * 0.35;

              const sleepRotate = awake ? 0 : 90;
              const sleepDrop = awake ? 0 : 48;

              const leanX = t * (28 * effort);
              const leanY = t * (-10 * effort);

              const bend = t * (focusField === "user" ? 10 : 8) * effort;
              const stretchY = 1 + t * 0.12 * effort;

              const backRot = turnedBack ? 180 : 0;

              const transform = `
                perspective(900px)
                translateY(${sleepDrop}px)
                rotate(${sleepRotate}deg)
                rotateZ(${bend}deg)
                rotateY(${backRot}deg)
                scaleY(${stretchY})
                translate3d(${leanX}px, ${leanY}px, 0)
              `;

              const hue = (205 + idx * 48) % 360;
              const bodyBg = `linear-gradient(
                180deg,
                hsla(${hue}, 80%, 88%, 0.70),
                hsla(${hue}, 55%, 76%, 0.30)
              )`;
              const borderColor = `hsla(${hue}, 35%, 30%, 0.12)`;

              const isPoker = nudge && pokerIndex === idx && spyIndex !== null;
              const pokerOnLeftOfSpy = isPoker && idx < spyIndex;
              const logicalSide = pokerOnLeftOfSpy ? "right" : "left";
              const side = turnedBack ? (logicalSide === "right" ? "left" : "right") : logicalSide;

              const n = CREATURES.length;
              const leftPad = 6;
              const rightPad = 6;
              const usableW = Math.max(0, stageW - leftPad - rightPad);
              const laneT = n <= 1 ? 0.5 : idx / (n - 1);
              const curvedT = Math.pow(laneT, 0.92);
              const laneX = leftPad + usableW * curvedT;

              const rawLeft = laneX - c.w / 2 + (JITTER[idx] || 0);
              const leftPx = stageW > 0 ? clamp(rawLeft, -10, stageW - c.w + 10) : idx * 92;

              return (
                <div
                  key={idx}
                  ref={(el) => (creatureRefs.current[idx] = el)}
                  className="relative"
                  style={{
                    position: "absolute",
                    left: leftPx,
                    bottom: 0,
                    width: c.w,
                    height: c.h,
                    transform,
                    transformOrigin: awake ? "bottom center" : "bottom left",
                    transition: "transform 520ms cubic-bezier(.2,.9,.2,1), filter 320ms ease",
                    filter: awake ? "none" : "blur(0.2px)",
                  }}
                  aria-hidden
                >
                  <div
                    className="absolute inset-0 rounded-2xl border"
                    style={{
                      background: bodyBg,
                      borderColor,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 14px 22px rgba(15,23,42,0.10)",
                    }}
                  />

                  {turnedBack && (
                    <div
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background: "linear-gradient(180deg, rgba(15,23,42,0.06), rgba(15,23,42,0.16))",
                        opacity: 0.95,
                      }}
                    />
                  )}

                  <div
                    className="absolute left-1/2 -translate-x-1/2 flex gap-2"
                    style={{ top: 22, opacity: turnedBack ? 0 : awake ? 1 : 0.25, transition: "opacity 240ms ease" }}
                  >
                    {[0, 1].map((eye) => (
                      <div
                        key={eye}
                        className="relative rounded-full"
                        style={{
                          width: 16,
                          height: 16,
                          background: "rgba(255,255,255,0.95)",
                          boxShadow: "0 2px 8px rgba(15,23,42,0.18)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          className="absolute rounded-full"
                          style={{
                            width: 8,
                            height: 8,
                            left: "50%",
                            top: "50%",
                            transform: `translate(-50%, -50%) translate(${px}px, ${py}px)`,
                            background: "rgba(15,23,42,0.95)",
                            transition: "transform 40ms linear",
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{
                      top: 46,
                      width: 18,
                      height: 3,
                      borderRadius: 999,
                      background: turnedBack ? "transparent" : isSpy ? "rgba(15,23,42,0.45)" : "rgba(15,23,42,0.28)",
                      opacity: awake ? 1 : 0.25,
                    }}
                  />

                  {isPoker && (
                    <>
                      <div
                        className="absolute"
                        style={{
                          [side]: -20,
                          top: Math.max(80, c.h * 0.38),
                          width: 26,
                          height: 7,
                          borderRadius: 999,
                          background: "rgba(15,23,42,0.25)",
                          transform: side === "right" ? "rotate(-10deg)" : "rotate(10deg)",
                          animation: "poke 520ms ease-in-out infinite",
                        }}
                      />
                      <div
                        className="absolute text-[10px] text-slate-600"
                        style={{
                          [side]: -10,
                          top: Math.max(32, c.h * 0.26),
                          transform: side === "right" ? "rotate(-8deg)" : "rotate(8deg)",
                          userSelect: "none",
                        }}
                      >
                        psst!
                      </div>
                    </>
                  )}

                  {nudge && isSpy && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 text-[12px]"
                      style={{ top: 8, userSelect: "none", animation: "blush 900ms ease-in-out infinite" }}
                    >
                      😳
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <style>{`
            @keyframes poke {
              0%, 100% { transform: translateX(0); opacity: .55; }
              50% { transform: translateX(5px); opacity: .9; }
            }
            @keyframes blush {
              0%, 100% { transform: translateX(-50%) translateY(0); opacity: .7; }
              50% { transform: translateX(-50%) translateY(-2px); opacity: 1; }
            }
          `}</style>
        </div>

        {/* DIREITA: LOGIN/CADASTRO */}
        <div className="flex items-center justify-center px-6 py-10">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-md bg-white rounded-2xl p-8 shadow-[0_18px_45px_rgba(15,23,42,0.10)]"
          >
            <h2 className="text-2xl font-semibold text-center">{mode === "login" ? "Entrar" : "Cadastrar"}</h2>
            <p className="text-sm text-slate-500 text-center mt-1">
              {mode === "login" ? "Digite seu usuário e senha." : "Crie um usuário (nome único) e uma senha."}
            </p>

            <div className="mt-6">
              <label className="block text-xs text-slate-600 mb-1">Usuário</label>
              <input
                ref={userInputRef}
                value={user}
                onChange={(e) => setUser(e.target.value)}
                onFocus={() => setFocusField("user")}
                onBlur={() => setFocusField(null)}
                placeholder="Nome de usuário"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs text-slate-600 mb-1">Senha</label>
              <div className="flex gap-2">
                <input
                  ref={passInputRef}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  onFocus={() => setFocusField("pass")}
                  onBlur={() => setFocusField(null)}
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="w-11 border rounded-lg flex items-center justify-center hover:bg-slate-50"
                  title={showPass ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
              {mode === "register" && <div className="text-xs text-slate-500 mt-1">mínimo 4 caracteres</div>}
            </div>

            <button
              type="submit"
              disabled={busy}
              className={`w-full mt-6 py-2.5 rounded-lg font-medium text-white ${
                busy ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {busy ? "..." : mode === "login" ? "Entrar" : "Cadastrar"}
            </button>

            <div className="mt-4 flex items-center justify-between text-sm">
              {mode === "login" ? (
                <>
                  <button type="button" className="text-slate-600 hover:underline" onClick={() => setMode("register")}>
                    Criar conta
                  </button>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">primeiro usuário vira admin</span>
                </>
              ) : (
                <>
                  <button type="button" className="text-slate-600 hover:underline" onClick={() => setMode("login")}>
                    Já tenho conta
                  </button>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">username é único</span>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
