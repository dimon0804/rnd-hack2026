import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const GRID = 20;
const TICK_MS = 115;
const HIGH_SCORE_KEY = "offline-snake-highscore";

type Point = { x: number; y: number };

function occupationSet(snake: Point[]): Set<string> {
  return new Set(snake.map((p) => `${p.x},${p.y}`));
}

function randomFood(occupied: Set<string>): Point {
  for (let i = 0; i < 8000; i++) {
    const x = Math.floor(Math.random() * GRID);
    const y = Math.floor(Math.random() * GRID);
    const k = `${x},${y}`;
    if (!occupied.has(k)) return { x, y };
  }
  return { x: 0, y: 0 };
}

export function OfflineSnakePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  const snakeRef = useRef<Point[]>([
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ]);
  const dirRef = useRef<Point>({ x: 1, y: 0 });
  const pendingDirRef = useRef<Point>({ x: 1, y: 0 });
  const foodRef = useRef<Point>({ x: 12, y: 10 });
  const aliveRef = useRef(true);
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);

  const resetGame = useCallback(() => {
    const snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    snakeRef.current = snake;
    dirRef.current = { x: 1, y: 0 };
    pendingDirRef.current = { x: 1, y: 0 };
    foodRef.current = randomFood(occupationSet(snake));
    aliveRef.current = true;
    pausedRef.current = false;
    scoreRef.current = 0;
    setPaused(false);
    setGameOver(false);
    setScore(0);
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem(HIGH_SCORE_KEY);
      const n = v ? parseInt(v, 10) : 0;
      if (!Number.isNaN(n)) setHighScore(n);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const css = 360;
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr);
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const cell = css / GRID;

    const readVar = (name: string, fallback: string) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    };

    const finishGame = () => {
      aliveRef.current = false;
      setGameOver(true);
      const s = scoreRef.current;
      setHighScore((h) => {
        const nh = Math.max(h, s);
        try {
          localStorage.setItem(HIGH_SCORE_KEY, String(nh));
        } catch {
          /* ignore */
        }
        return nh;
      });
    };

    const draw = () => {
      const surface = readVar("--surface", "#fffdf8");
      const border = readVar("--border", "#d4cdc0");
      const accent = readVar("--accent", "#124238");
      const danger = readVar("--danger", "#9b2d3c");

      ctx.fillStyle = surface;
      ctx.fillRect(0, 0, css, css);
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, css);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(css, i * cell);
        ctx.stroke();
      }

      const food = foodRef.current;
      ctx.fillStyle = danger;
      ctx.beginPath();
      ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell * 0.32, 0, Math.PI * 2);
      ctx.fill();

      const snake = snakeRef.current;
      snake.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? accent : `${accent}cc`;
        const pad = cell * 0.12;
        ctx.fillRect(seg.x * cell + pad, seg.y * cell + pad, cell - pad * 2, cell - pad * 2);
      });
    };

    const tick = () => {
      if (!aliveRef.current || pausedRef.current) {
        draw();
        return;
      }

      const d = pendingDirRef.current;
      const cur = dirRef.current;
      if (!(d.x === -cur.x && d.y === -cur.y)) {
        dirRef.current = d;
      }
      const { x: dx, y: dy } = dirRef.current;
      const head = snakeRef.current[0];
      const next = { x: head.x + dx, y: head.y + dy };

      if (next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID) {
        finishGame();
        draw();
        return;
      }

      const hitSelf = snakeRef.current.some((p) => p.x === next.x && p.y === next.y);
      if (hitSelf) {
        finishGame();
        draw();
        return;
      }

      snakeRef.current = [next, ...snakeRef.current];
      const food = foodRef.current;
      if (next.x === food.x && next.y === food.y) {
        const occ = occupationSet(snakeRef.current);
        foodRef.current = randomFood(occ);
        scoreRef.current += 1;
        setScore(scoreRef.current);
      } else {
        snakeRef.current.pop();
      }
      draw();
    };

    draw();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [gameOver, paused]);

  useEffect(() => {
    const setDir = (dx: number, dy: number) => {
      pendingDirRef.current = { x: dx, y: dy };
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (gameOver) resetGame();
        else setPaused((p) => !p);
        return;
      }
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          setDir(0, -1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          setDir(0, 1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          setDir(-1, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          setDir(1, 0);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameOver, resetGame]);

  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || !e.changedTouches[0]) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < 24 && absY < 24) return;
    if (absX > absY) pendingDirRef.current = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    else pendingDirRef.current = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
  };

  return (
    <main id="main" tabIndex={-1} className="offline-snake-page">
      <div className="offline-snake-page__inner">
        <p className="offline-snake-page__crumb">
          <Link to="/">На главную</Link>
        </p>
        <h1 className="offline-snake-page__title">Змейка</h1>
        <p className="offline-snake-page__hint muted">
          Стрелки или WASD. Пробел — пауза. На телефоне — свайп. Съедайте яблоко — змейка растёт.
        </p>
        <div className="offline-snake-page__hud">
          <span>
            Очки: <strong>{score}</strong>
          </span>
          <span>
            Рекорд: <strong>{highScore}</strong>
          </span>
          {paused && !gameOver ? <span className="offline-snake-page__pause">Пауза</span> : null}
        </div>
        <div
          className="offline-snake-page__canvas-wrap"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <canvas ref={canvasRef} className="offline-snake-page__canvas" aria-label="Поле змейки" />
          {gameOver ? (
            <div className="offline-snake-page__overlay">
              <p className="offline-snake-page__over-title">Игра окончена</p>
              <button type="button" className="btn-solid" onClick={resetGame}>
                Сыграть снова
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
