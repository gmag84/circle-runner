import { useState, useEffect, useRef, useCallback } from "react";

const CANVAS_W = 800;
const CANVAS_H = 500;
const PLAYER_R = 18;
const OBSTACLE_R = 14;
const TRAIL_LEN = 18;

function randomColor() {
  const hues = [190, 280, 340, 50, 140];
  return `hsl(${hues[Math.floor(Math.random() * hues.length)]}, 90%, 65%)`;
}

export default function App() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    player: { x: CANVAS_W / 2, y: CANVAS_H / 2, vx: 0, vy: 0, trail: [] },
    obstacles: [],
    particles: [],
    score: 0,
    highScore: 0,
    phase: "idle",
    keys: {},
    frameId: null,
    lastObstacle: 0,
    lastTime: 0,
    speed: 1,
  });
  const [display, setDisplay] = useState({ score: 0, high: 0, phase: "idle" });

  const spawnObstacle = useCallback((now) => {
    const s = stateRef.current;
    if (now - s.lastObstacle < Math.max(600, 1200 - s.score * 2)) return;
    s.lastObstacle = now;
    const side = Math.floor(Math.random() * 4);
    let x, y, vx, vy;
    const spd = 2 + s.score * 0.015;
    if (side === 0) { x = Math.random() * CANVAS_W; y = -20; vx = (Math.random() - 0.5) * spd; vy = spd; }
    else if (side === 1) { x = CANVAS_W + 20; y = Math.random() * CANVAS_H; vx = -spd; vy = (Math.random() - 0.5) * spd; }
    else if (side === 2) { x = Math.random() * CANVAS_W; y = CANVAS_H + 20; vx = (Math.random() - 0.5) * spd; vy = -spd; }
    else { x = -20; y = Math.random() * CANVAS_H; vx = spd; vy = (Math.random() - 0.5) * spd; }
    s.obstacles.push({ x, y, vx, vy, color: randomColor(), r: OBSTACLE_R });
  }, []);

  const burst = useCallback((x, y, color) => {
    const s = stateRef.current;
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
    }
  }, []);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.player = { x: CANVAS_W / 2, y: CANVAS_H / 2, vx: 0, vy: 0, trail: [] };
    s.obstacles = [];
    s.particles = [];
    s.score = 0;
    s.phase = "playing";
    s.lastObstacle = performance.now();
    s.lastTime = performance.now();
    s.speed = 1;
    setDisplay(d => ({ ...d, score: 0, phase: "playing" }));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      stateRef.current.keys[e.code] = e.type === "keydown";
      if (e.code === "Space" || e.code === "Enter") {
        if (stateRef.current.phase !== "playing") startGame();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
  }, [startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const loop = (now) => {
      const s = stateRef.current;
      const dt = Math.min((now - s.lastTime) / 16.67, 3);
      s.lastTime = now;

      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.strokeStyle = "rgba(80,80,180,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke(); }
      for (let y = 0; y < CANVAS_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke(); }

      if (s.phase === "playing") {
        const acc = 0.45 * dt;
        const maxSpd = 6;
        const friction = 0.88;
        const { keys, player } = s;

        if (keys["ArrowLeft"] || keys["KeyA"]) player.vx -= acc;
        if (keys["ArrowRight"] || keys["KeyD"]) player.vx += acc;
        if (keys["ArrowUp"] || keys["KeyW"]) player.vy -= acc;
        if (keys["ArrowDown"] || keys["KeyS"]) player.vy += acc;

        player.vx *= friction;
        player.vy *= friction;
        const mag = Math.sqrt(player.vx ** 2 + player.vy ** 2);
        if (mag > maxSpd) { player.vx = (player.vx / mag) * maxSpd; player.vy = (player.vy / mag) * maxSpd; }

        player.x += player.vx * dt;
        player.y += player.vy * dt;
        player.x = Math.max(PLAYER_R, Math.min(CANVAS_W - PLAYER_R, player.x));
        player.y = Math.max(PLAYER_R, Math.min(CANVAS_H - PLAYER_R, player.y));

        player.trail.unshift({ x: player.x, y: player.y });
        if (player.trail.length > TRAIL_LEN) player.trail.pop();

        spawnObstacle(now);
        s.score += dt * 0.5;
        s.speed = 1 + s.score * 0.005;

        s.obstacles = s.obstacles.filter(o => {
          o.x += o.vx * dt * s.speed;
          o.y += o.vy * dt * s.speed;
          return o.x > -50 && o.x < CANVAS_W + 50 && o.y > -50 && o.y < CANVAS_H + 50;
        });

        for (const o of s.obstacles) {
          const dx = player.x - o.x, dy = player.y - o.y;
          if (Math.sqrt(dx * dx + dy * dy) < PLAYER_R + o.r - 4) {
            burst(player.x, player.y, "#ff6af0");
            s.phase = "dead";
            if (s.score > s.highScore) s.highScore = s.score;
            setDisplay({ score: Math.floor(s.score), high: Math.floor(s.highScore), phase: "dead" });
            break;
          }
        }
      }

      s.particles = s.particles.filter(p => p.life > 0);
      for (const p of s.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.03 * dt;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const { player } = stateRef.current;
      for (let i = 0; i < player.trail.length; i++) {
        const t = player.trail[i];
        const alpha = (1 - i / TRAIL_LEN) * 0.35;
        const r = PLAYER_R * (1 - i / TRAIL_LEN) * 0.8;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#a0e8ff";
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const o of stateRef.current.obstacles) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = o.color;
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      const p = stateRef.current.player;
      ctx.shadowBlur = 28;
      ctx.shadowColor = "#a0e8ff";
      const grad = ctx.createRadialGradient(p.x - 5, p.y - 5, 2, p.x, p.y, PLAYER_R);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.4, "#a0e8ff");
      grad.addColorStop(1, "#4040ff");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = "bold 22px 'Courier New', monospace";
      ctx.fillStyle = "#a0e8ff";
      ctx.textAlign = "left";
      ctx.fillText(`SCORE  ${Math.floor(stateRef.current.score)}`, 18, 34);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ff9ef5";
      ctx.fillText(`BEST  ${Math.floor(stateRef.current.highScore)}`, CANVAS_W - 18, 34);

      if (stateRef.current.phase === "idle") {
        ctx.fillStyle = "rgba(5,5,20,0.75)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.textAlign = "center";
        ctx.font = "bold 52px 'Courier New', monospace";
        ctx.fillStyle = "#a0e8ff";
        ctx.shadowBlur = 30; ctx.shadowColor = "#a0e8ff";
        ctx.fillText("CIRCLE RUNNER", CANVAS_W / 2, CANVAS_H / 2 - 40);
        ctx.shadowBlur = 0;
        ctx.font = "20px 'Courier New', monospace";
        ctx.fillStyle = "#ffffff99";
        ctx.fillText("WASD / ARROWS TO MOVE  ·  SPACE TO START", CANVAS_W / 2, CANVAS_H / 2 + 20);
      }

      if (stateRef.current.phase === "dead") {
        ctx.fillStyle = "rgba(5,5,20,0.8)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.textAlign = "center";
        ctx.font = "bold 46px 'Courier New', monospace";
        ctx.fillStyle = "#ff6af0";
        ctx.shadowBlur = 30; ctx.shadowColor = "#ff6af0";
        ctx.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 50);
        ctx.shadowBlur = 0;
        ctx.font = "24px 'Courier New', monospace";
        ctx.fillStyle = "#a0e8ff";
        ctx.fillText(`SCORE  ${Math.floor(stateRef.current.score)}`, CANVAS_W / 2, CANVAS_H / 2 + 5);
        ctx.fillStyle = "#ff9ef5";
        ctx.fillText(`BEST  ${Math.floor(stateRef.current.highScore)}`, CANVAS_W / 2, CANVAS_H / 2 + 38);
        ctx.font = "18px 'Courier New', monospace";
        ctx.fillStyle = "#ffffff77";
        ctx.fillText("PRESS SPACE TO PLAY AGAIN", CANVAS_W / 2, CANVAS_H / 2 + 80);
      }

      s.frameId = requestAnimationFrame(loop);
    };

    stateRef.current.frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(stateRef.current.frameId);
  }, [spawnObstacle, burst]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#020208",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{ marginBottom: 18, letterSpacing: 6, color: "#4a4a8a", fontSize: 12, textTransform: "uppercase" }}>
        ◈ Circle Runner ◈
      </div>
      <div style={{
        position: "relative",
        borderRadius: 4,
        overflow: "hidden",
        boxShadow: "0 0 60px rgba(80,80,255,0.25), 0 0 120px rgba(80,80,255,0.1)",
        border: "1px solid rgba(80,80,200,0.3)",
      }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
      </div>
      <div style={{ marginTop: 18, color: "#2a2a5a", fontSize: 11, letterSpacing: 3 }}>
        DODGE ALL CIRCLES · SURVIVE AS LONG AS YOU CAN
      </div>
    </div>
  );
}
