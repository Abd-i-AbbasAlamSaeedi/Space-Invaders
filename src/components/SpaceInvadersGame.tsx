import React, { useEffect, useMemo, useRef, useState } from 'react';

type Bullet = {
  id: number;
  x: number;
  y: number;
};

type Enemy = {
  id: number;
  x: number;
  y: number;
  speed: number;
};

type GameStatus = 'ready' | 'playing' | 'game-over';

type AssetState = {
  loaded: boolean;
  failed: boolean;
};

const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;
const SHIP_WIDTH = 96;
const SHIP_HEIGHT = 72;
const BULLET_WIDTH = 18;
const BULLET_HEIGHT = 42;
const ENEMY_WIDTH = 84;
const ENEMY_HEIGHT = 72;

const SHIP_SPEED = 680; // px/s
const BULLET_SPEED = 920; // px/s
const MIN_ENEMY_SPEED = 140; // px/s
const MAX_ENEMY_SPEED = 300; // px/s
const ENEMY_SPAWN_EVERY_MS = 600;
const SHOOT_COOLDOWN_MS = 180;

const ASSETS = {
  ship: 'https://raw.githubusercontent.com/kenneyNL/space-shooter-redux/master/PNG/playerShip1_blue.png',
  enemy: 'https://raw.githubusercontent.com/kenneyNL/space-shooter-redux/master/PNG/Enemies/enemyBlack1.png',
  bullet: 'https://raw.githubusercontent.com/kenneyNL/space-shooter-redux/master/PNG/Lasers/laserBlue01.png',
  starfield: 'https://raw.githubusercontent.com/kenneyNL/space-shooter-redux/master/Backgrounds/blue.png',
};

function intersects(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export default function SpaceInvadersGame() {
  const [status, setStatus] = useState<GameStatus>('ready');
  const [score, setScore] = useState(0);
  const [assetState, setAssetState] = useState<AssetState>({ loaded: false, failed: false });

  const [shipX, setShipX] = useState((GAME_WIDTH - SHIP_WIDTH) / 2);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);

  const shipXRef = useRef(shipX);
  const statusRef = useRef<GameStatus>(status);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastSpawnAtRef = useRef<number>(0);
  const lastShootAtRef = useRef<number>(0);
  const idCounterRef = useRef<number>(1);

  const hudMessage = useMemo(() => {
    if (status === 'ready') return 'Press Enter to start';
    if (status === 'game-over') return 'Game over — Press Enter to restart';
    return 'Arrow keys to move · Spacebar to shoot';
  }, [status]);

  const resetGame = () => {
    setStatus('playing');
    statusRef.current = 'playing';
    setScore(0);
    setShipX((GAME_WIDTH - SHIP_WIDTH) / 2);
    shipXRef.current = (GAME_WIDTH - SHIP_WIDTH) / 2;
    setBullets([]);
    setEnemies([]);
    lastTimeRef.current = 0;
    lastSpawnAtRef.current = 0;
    lastShootAtRef.current = 0;
  };

  useEffect(() => {
    // Preload sprite sheets/background to avoid flicker on first render.
    const urls = Object.values(ASSETS);
    let loadedCount = 0;
    let hasError = false;

    urls.forEach((url) => {
      const image = new Image();
      image.onload = () => {
        loadedCount += 1;
        if (loadedCount === urls.length && !hasError) {
          setAssetState({ loaded: true, failed: false });
        }
      };
      image.onerror = () => {
        hasError = true;
        setAssetState({ loaded: true, failed: true });
      };
      image.src = url;
    });
  }, []);

  useEffect(() => {
    shipXRef.current = shipX;
  }, [shipX]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(event.code)) {
        event.preventDefault();
      }

      pressedKeysRef.current.add(event.code);

      if (event.code === 'Enter' && status !== 'playing') {
        resetGame();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [status]);

  useEffect(() => {
    const tick = (time: number) => {
      const prev = lastTimeRef.current || time;
      const dt = (time - prev) / 1000;
      lastTimeRef.current = time;

      if (statusRef.current === 'playing') {
        const keys = pressedKeysRef.current;

        setShipX((currentX) => {
          let nextX = currentX;
          if (keys.has('ArrowLeft')) nextX -= SHIP_SPEED * dt;
          if (keys.has('ArrowRight')) nextX += SHIP_SPEED * dt;
          const clamped = Math.max(0, Math.min(GAME_WIDTH - SHIP_WIDTH, nextX));
          shipXRef.current = clamped;
          return clamped;
        });

        if (keys.has('Space') && time - lastShootAtRef.current > SHOOT_COOLDOWN_MS) {
          lastShootAtRef.current = time;
          setBullets((current) => [
            ...current,
            {
              id: idCounterRef.current++,
              x: shipXRef.current + SHIP_WIDTH / 2 - BULLET_WIDTH / 2,
              y: GAME_HEIGHT - SHIP_HEIGHT - BULLET_HEIGHT - 16,
            },
          ]);
        }

        if (time - lastSpawnAtRef.current > ENEMY_SPAWN_EVERY_MS) {
          lastSpawnAtRef.current = time;
          const maxX = GAME_WIDTH - ENEMY_WIDTH;
          const x = Math.random() * maxX;
          const speed = MIN_ENEMY_SPEED + Math.random() * (MAX_ENEMY_SPEED - MIN_ENEMY_SPEED);

          setEnemies((current) => [...current, { id: idCounterRef.current++, x, y: -ENEMY_HEIGHT, speed }]);
        }

        setBullets((current) =>
          current
            .map((bullet) => ({ ...bullet, y: bullet.y - BULLET_SPEED * dt }))
            .filter((bullet) => bullet.y + BULLET_HEIGHT > 0),
        );

        setEnemies((current) =>
          current
            .map((enemy) => ({ ...enemy, y: enemy.y + enemy.speed * dt }))
            .filter((enemy) => enemy.y < GAME_HEIGHT + ENEMY_HEIGHT),
        );
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  useEffect(() => {
    if (status !== 'playing') return;

    const hitEnemyIds = new Set<number>();
    const hitBulletIds = new Set<number>();

    for (const bullet of bullets) {
      for (const enemy of enemies) {
        if (
          intersects(
            bullet.x,
            bullet.y,
            BULLET_WIDTH,
            BULLET_HEIGHT,
            enemy.x,
            enemy.y,
            ENEMY_WIDTH,
            ENEMY_HEIGHT,
          )
        ) {
          hitEnemyIds.add(enemy.id);
          hitBulletIds.add(bullet.id);
        }
      }
    }

    if (hitEnemyIds.size > 0) {
      setEnemies((current) => current.filter((enemy) => !hitEnemyIds.has(enemy.id)));
      setBullets((current) => current.filter((bullet) => !hitBulletIds.has(bullet.id)));
      setScore((current) => current + hitEnemyIds.size * 10);
    }

    const shipY = GAME_HEIGHT - SHIP_HEIGHT - 12;
    const enemyReachedShip = enemies.some((enemy) => enemy.y + ENEMY_HEIGHT >= shipY);
    if (enemyReachedShip) {
      setStatus('game-over');
      statusRef.current = 'game-over';
    }
  }, [bullets, enemies, status]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between text-slate-100">
        <h1 className="text-xl font-bold md:text-2xl">Space Invaders (Image Assets Edition)</h1>
        <div className="rounded-md bg-slate-800/90 px-3 py-2 text-sm font-semibold">
          Score: <span className="text-emerald-300">{score}</span>
        </div>
      </div>

      {/* Strict responsive 16:9 game viewport */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
        {/* Scrolling starfield image layers */}
        <div
          className="absolute inset-0 bg-repeat-y opacity-70"
          style={{
            backgroundImage: `url(${ASSETS.starfield})`,
            backgroundSize: 'cover',
            animation: 'star-scroll 18s linear infinite',
          }}
        />
        <div
          className="absolute inset-0 bg-repeat-y opacity-40"
          style={{
            backgroundImage: `url(${ASSETS.starfield})`,
            backgroundSize: 'cover',
            animation: 'star-scroll 30s linear infinite reverse',
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            width: `${GAME_WIDTH}px`,
            height: `${GAME_HEIGHT}px`,
            transform: 'scale(var(--game-scale, 1))',
            transformOrigin: 'top left',
          }}
        >
          {assetState.loaded && !assetState.failed ? (
            <>
              {/* Player ship sprite */}
              <img
                src={ASSETS.ship}
                alt="Player ship"
                draggable={false}
                className="pointer-events-none absolute select-none object-contain drop-shadow-[0_0_14px_rgba(56,189,248,0.7)]"
                style={{
                  width: SHIP_WIDTH,
                  height: SHIP_HEIGHT,
                  left: shipX,
                  top: GAME_HEIGHT - SHIP_HEIGHT - 12,
                }}
              />

              {/* Bullet sprites */}
              {bullets.map((bullet) => (
                <img
                  key={bullet.id}
                  src={ASSETS.bullet}
                  alt="Laser projectile"
                  draggable={false}
                  className="pointer-events-none absolute select-none object-contain"
                  style={{
                    width: BULLET_WIDTH,
                    height: BULLET_HEIGHT,
                    left: bullet.x,
                    top: bullet.y,
                  }}
                />
              ))}

              {/* Enemy sprites */}
              {enemies.map((enemy) => (
                <img
                  key={enemy.id}
                  src={ASSETS.enemy}
                  alt="Enemy ship"
                  draggable={false}
                  className="pointer-events-none absolute select-none object-contain drop-shadow-[0_0_10px_rgba(244,63,94,0.45)]"
                  style={{
                    width: ENEMY_WIDTH,
                    height: ENEMY_HEIGHT,
                    left: enemy.x,
                    top: enemy.y,
                  }}
                />
              ))}
            </>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-slate-200">
              Loading game assets...
            </div>
          )}

          {assetState.failed && (
            <div className="absolute inset-x-0 top-4 mx-auto w-fit rounded bg-rose-950/80 px-3 py-2 text-xs text-rose-100">
              Some CDN assets failed to load. Check network/CORS and refresh.
            </div>
          )}
        </div>

        {(status === 'ready' || status === 'game-over') && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/65 p-4 text-center">
            <div className="rounded-xl border border-slate-600 bg-slate-900/90 px-6 py-5 text-slate-100">
              <p className="mb-2 text-lg font-semibold">{status === 'ready' ? 'Ready?' : 'You were overrun!'}</p>
              <p className="text-sm text-slate-300">{hudMessage}</p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-slate-300">{hudMessage}</p>

      <style>{`
        .aspect-video > .absolute.inset-0 {
          --game-scale: min(100cqw / ${GAME_WIDTH}, 100cqh / ${GAME_HEIGHT});
        }

        @keyframes star-scroll {
          from { background-position: 0 0; }
          to { background-position: 0 1200px; }
        }
      `}</style>
    </div>
  );
}
