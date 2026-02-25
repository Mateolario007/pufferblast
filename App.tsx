/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Play, Pause, Volume2, VolumeX } from 'lucide-react';

// --- Constants & Types ---

const GRID_ROWS = 12;
const GRID_COLS = 8;
const BUBBLE_RADIUS = 20;
const CANVAS_WIDTH = GRID_COLS * BUBBLE_RADIUS * 2;
const CANVAS_HEIGHT = 500;
const COLORS = ['#FF5555', '#55FF55', '#5555FF', '#FFFF55', '#FF55FF', '#55FFFF'];
const PIXEL_SIZE = 4;

type Bubble = {
  x: number;
  y: number;
  color: string;
  id: string;
};

type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
};

// --- Helper Functions ---

const getDistance = (x1: number, y1: number, x2: number, y2: number) => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

const drawPixelCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, isPuffer: boolean = false) => {
  ctx.fillStyle = color;
  const r = Math.round(radius / PIXEL_SIZE) * PIXEL_SIZE;
  
  for (let dy = -r; dy <= r; dy += PIXEL_SIZE) {
    for (let dx = -r; dx <= r; dx += PIXEL_SIZE) {
      if (dx * dx + dy * dy <= r * r) {
        ctx.fillRect(Math.round((x + dx) / PIXEL_SIZE) * PIXEL_SIZE, Math.round((y + dy) / PIXEL_SIZE) * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }
  }

  if (isPuffer) {
    // Draw eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(Math.round((x - 6) / PIXEL_SIZE) * PIXEL_SIZE, Math.round((y - 4) / PIXEL_SIZE) * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(Math.round((x + 2) / PIXEL_SIZE) * PIXEL_SIZE, Math.round((y - 4) / PIXEL_SIZE) * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    
    // Draw spikes (simplified)
    ctx.fillStyle = '#FFF';
    ctx.fillRect(Math.round((x - 12) / PIXEL_SIZE) * PIXEL_SIZE, Math.round(y / PIXEL_SIZE) * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(Math.round((x + 8) / PIXEL_SIZE) * PIXEL_SIZE, Math.round(y / PIXEL_SIZE) * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(Math.round(x / PIXEL_SIZE) * PIXEL_SIZE, Math.round((y - 12) / PIXEL_SIZE) * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
  } else {
    // Bubble shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(Math.round((x - 8) / PIXEL_SIZE) * PIXEL_SIZE, Math.round((y - 8) / PIXEL_SIZE) * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
  }
};

type FloatingImage = {
  x: number;
  y: number;
  opacity: number;
  imageIndex: number;
  id: string;
};

type HeartParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  id: string;
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [nextColor, setNextColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [isMuted, setIsMuted] = useState(false);
  const [floatingImages, setFloatingImages] = useState<FloatingImage[]>([]);

  const projectileRef = useRef<Projectile | null>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const floatingImagesRef = useRef<FloatingImage[]>([]);
  const heartParticlesRef = useRef<HeartParticle[]>([]);
  const animationFrameRef = useRef<number>(0);
  
  const userImageUrls = [
    "https://image2url.com/r2/default/images/1772049578527-cc5ef6ab-d4cc-4c88-9077-18c35441f017.jpeg",
    "https://image2url.com/r2/default/images/1772050044977-fa2b046f-2d2a-4627-be38-c5ab634d07f1.jpeg",
    "https://image2url.com/r2/default/images/1772050073776-612c55db-45b4-4ce2-9677-cce9b0852eaf.jpeg",
    "https://image2url.com/r2/default/images/1772050096697-b019d407-59c5-4046-869c-d0c950182717.jpeg",
    "https://image2url.com/r2/default/images/1772050117430-bbb9386d-78f1-45dd-b43a-65a0623023ca.jpeg",
    "https://image2url.com/r2/default/images/1772050136090-b7330c6e-ae8f-4b7a-ac43-c0fed43d5c75.jpeg",
    "https://image2url.com/r2/default/images/1772050151622-42c43700-c7f2-45e8-a4b5-b9212cfa5b3e.jpeg",
    "https://image2url.com/r2/default/images/1772050457022-7499d175-f4c9-4b4f-9f41-d4404f87b64f.jpeg"
  ];
  const userImagesRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    userImageUrls.forEach((url, index) => {
      const img = new Image();
      img.src = url;
      img.referrerPolicy = "no-referrer";
      img.onload = () => {
        userImagesRef.current[index] = img;
      };
    });
  }, []);

  // --- Grid Helpers ---

  const getRow = (y: number) => Math.round((y - BUBBLE_RADIUS) / (BUBBLE_RADIUS * 1.732));
  
  const getCol = (x: number, row: number) => {
    const isOffset = row % 2 !== 0;
    const offsetX = isOffset ? BUBBLE_RADIUS : 0;
    return Math.round((x - BUBBLE_RADIUS - offsetX) / (BUBBLE_RADIUS * 2));
  };

  const getX = (row: number, col: number) => {
    const isOffset = row % 2 !== 0;
    return col * BUBBLE_RADIUS * 2 + BUBBLE_RADIUS + (isOffset ? BUBBLE_RADIUS : 0);
  };

  const getY = (row: number) => {
    return row * BUBBLE_RADIUS * 1.732 + BUBBLE_RADIUS;
  };

  // Initialize bubbles
  const initGame = () => {
    const initialBubbles: Bubble[] = [];
    for (let row = 0; row < 6; row++) {
      const colsInRow = row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
      for (let col = 0; col < colsInRow; col++) {
        initialBubbles.push({
          x: getX(row, col),
          y: getY(row),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          id: `${row}-${col}-${Math.random()}`
        });
      }
    }
    setBubbles(initialBubbles);
    bubblesRef.current = initialBubbles;
    floatingImagesRef.current = [];
    heartParticlesRef.current = [];
    setFloatingImages([]);
    setScore(0);
    setGameState('playing');
    projectileRef.current = null;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing' || projectileRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const targetX = e.clientX - rect.left;
    const targetY = e.clientY - rect.top;

    const startX = CANVAS_WIDTH / 2;
    const startY = CANVAS_HEIGHT - 40;

    const angle = Math.atan2(targetY - startY, targetX - startX);
    const speed = 8;

    projectileRef.current = {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: nextColor
    };

    setNextColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  const findMatches = (bubble: Bubble, currentBubbles: Bubble[], matches: Set<string> = new Set()) => {
    matches.add(bubble.id);
    const neighbors = currentBubbles.filter(b => 
      !matches.has(b.id) && 
      b.color === bubble.color && 
      getDistance(b.x, b.y, bubble.x, bubble.y) < BUBBLE_RADIUS * 2.5
    );

    neighbors.forEach(n => findMatches(n, currentBubbles, matches));
    return matches;
  };

  const findFloatingBubbles = (currentBubbles: Bubble[]) => {
    const connectedToTop = new Set<string>();
    const topRow = currentBubbles.filter(b => b.y <= BUBBLE_RADIUS * 2);
    
    const traverse = (bubble: Bubble) => {
      connectedToTop.add(bubble.id);
      const neighbors = currentBubbles.filter(b => 
        !connectedToTop.has(b.id) && 
        getDistance(b.x, b.y, bubble.x, bubble.y) < BUBBLE_RADIUS * 2.5
      );
      neighbors.forEach(traverse);
    };

    topRow.forEach(traverse);
    return currentBubbles.filter(b => !connectedToTop.has(b.id));
  };

  const createHeartExplosion = (x: number, y: number) => {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      heartParticlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 6,
        opacity: 1,
        id: `heart-${Date.now()}-${i}`
      });
    }
  };

  const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opacity: number) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, opacity);
    ctx.fillStyle = '#FF55AA';
    
    const px = Math.round(x / PIXEL_SIZE) * PIXEL_SIZE;
    const py = Math.round(y / PIXEL_SIZE) * PIXEL_SIZE;

    // 5x5 Pixel Heart
    // Row -2
    ctx.fillRect(px - 2 * PIXEL_SIZE, py - 2 * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px - PIXEL_SIZE, py - 2 * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px + PIXEL_SIZE, py - 2 * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px + 2 * PIXEL_SIZE, py - 2 * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    // Row -1
    ctx.fillRect(px - 2 * PIXEL_SIZE, py - PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px - PIXEL_SIZE, py - PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px, py - PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px + PIXEL_SIZE, py - PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px + 2 * PIXEL_SIZE, py - PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    // Row 0
    ctx.fillRect(px - 2 * PIXEL_SIZE, py, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px - PIXEL_SIZE, py, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px, py, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px + PIXEL_SIZE, py, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px + 2 * PIXEL_SIZE, py, PIXEL_SIZE, PIXEL_SIZE);
    // Row 1
    ctx.fillRect(px - PIXEL_SIZE, py + PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px, py + PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    ctx.fillRect(px + PIXEL_SIZE, py + PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    // Row 2
    ctx.fillRect(px, py + 2 * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const update = () => {
      if (gameState !== 'playing') return;

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw background grid (vintage feel)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < CANVAS_WIDTH; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let i = 0; i < CANVAS_HEIGHT; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(CANVAS_WIDTH, i);
        ctx.stroke();
      }

      // Draw bubbles
      bubblesRef.current.forEach(bubble => {
        drawPixelCircle(ctx, bubble.x, bubble.y, BUBBLE_RADIUS - 2, bubble.color);
      });

      // Update and draw floating images
      floatingImagesRef.current = floatingImagesRef.current.filter(img => img.y > -100);
      floatingImagesRef.current.forEach(img => {
        img.y -= 3;
        // Fade out near the top
        if (img.y < 100) {
          img.opacity -= 0.02;
        }
        const imgObj = userImagesRef.current[img.imageIndex];
        if (imgObj) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, img.opacity);
          
          // Maintain original proportions
          const targetWidth = 60;
          const ratio = imgObj.naturalHeight / imgObj.naturalWidth;
          const targetHeight = targetWidth * ratio;
          
          ctx.drawImage(imgObj, img.x - targetWidth / 2, img.y - targetHeight / 2, targetWidth, targetHeight);
          ctx.restore();
        }
      });

      // Update and draw heart particles
      heartParticlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.opacity -= 0.015;
        if (p.opacity > 0) {
          drawHeart(ctx, p.x, p.y, p.size, p.opacity);
        }
      });
      heartParticlesRef.current = heartParticlesRef.current.filter(p => p.opacity > 0);

      // Draw projectile (Pufferfish)
      if (projectileRef.current) {
        const p = projectileRef.current;
        p.x += p.vx;
        p.y += p.vy;

        // Wall bounce
        if (p.x < BUBBLE_RADIUS || p.x > CANVAS_WIDTH - BUBBLE_RADIUS) {
          p.vx *= -1;
        }

        // Collision detection
        let collided = false;
        
        // Hit top
        if (p.y < BUBBLE_RADIUS) {
          collided = true;
        }

        // Hit other bubbles
        for (const b of bubblesRef.current) {
          if (getDistance(p.x, p.y, b.x, b.y) < BUBBLE_RADIUS * 1.8) {
            collided = true;
            break;
          }
        }

        if (collided) {
          // Calculate the best grid position
          // We look at the point just before collision to find the intended cell
          const prevX = p.x - p.vx;
          const prevY = p.y - p.vy;
          
          let row = getRow(prevY);
          let col = getCol(prevX, row);

          // Ensure we don't overlap an existing bubble
          // If the calculated cell is occupied, we check neighbors
          const isOccupied = (r: number, c: number) => 
            bubblesRef.current.some(b => {
              const br = getRow(b.y);
              const bc = getCol(b.x, br);
              return br === r && bc === c;
            });

          if (isOccupied(row, col)) {
            // This is a fallback, usually prevX/prevY should be empty
            // but if not, we find the closest empty neighbor
            let bestDist = Infinity;
            let bestRow = row;
            let bestCol = col;

            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const nr = row + dr;
                const nc = col + dc;
                if (nr < 0) continue;
                if (!isOccupied(nr, nc)) {
                  const dist = getDistance(prevX, prevY, getX(nr, nc), getY(nr));
                  if (dist < bestDist) {
                    bestDist = dist;
                    bestRow = nr;
                    bestCol = nc;
                  }
                }
              }
            }
            row = bestRow;
            col = bestCol;
          }

          const newBubble: Bubble = {
            x: getX(row, col),
            y: getY(row),
            color: p.color,
            id: `new-${Date.now()}`
          };
          
          const updatedBubbles = [...bubblesRef.current, newBubble];
          const matches = findMatches(newBubble, updatedBubbles);

          if (matches.size >= 3) {
            const afterMatch = updatedBubbles.filter(b => !matches.has(b.id));
            const floating = findFloatingBubbles(afterMatch);
            const floatingIds = new Set(floating.map(f => f.id));
            const finalBubbles = afterMatch.filter(b => !floatingIds.has(b.id));
            
            bubblesRef.current = finalBubbles;
            setBubbles(finalBubbles);
            setScore(prev => prev + matches.size * 10 + floating.length * 20);

            // Create heart explosion at the match center
            createHeartExplosion(newBubble.x, newBubble.y);

            // Add floating user picture starting from bottom
            floatingImagesRef.current.push({
              x: newBubble.x,
              y: CANVAS_HEIGHT + 60,
              opacity: 1,
              imageIndex: Math.floor(Math.random() * userImageUrls.length),
              id: `float-${Date.now()}`
            });
          } else {
            bubblesRef.current = updatedBubbles;
            setBubbles(updatedBubbles);
          }

          projectileRef.current = null;

          // Check Game Over
          if (bubblesRef.current.some(b => b.y > CANVAS_HEIGHT - 100)) {
            setGameState('gameover');
          }
        } else if (p.y < -BUBBLE_RADIUS || p.y > CANVAS_HEIGHT + BUBBLE_RADIUS) {
          projectileRef.current = null;
        }

        if (projectileRef.current) {
          drawPixelCircle(ctx, p.x, p.y, BUBBLE_RADIUS, p.color, true);
        }
      }

      // Draw shooter base
      ctx.fillStyle = '#333';
      ctx.fillRect(CANVAS_WIDTH / 2 - 20, CANVAS_HEIGHT - 20, 40, 20);
      drawPixelCircle(ctx, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40, BUBBLE_RADIUS, nextColor, true);

      animationFrameRef.current = requestAnimationFrame(update);
    };

    animationFrameRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [gameState, nextColor]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#e0e0e0] font-mono flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tighter text-[#55FF55] mb-2 uppercase italic">
          Puffer Blast
        </h1>
        <div className="flex items-center justify-center gap-4 text-sm opacity-70">
          <div className="flex items-center gap-1">
            <Trophy size={16} />
            <span>Score: {score}</span>
          </div>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="hover:text-white transition-colors"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>

      {/* Game Container */}
      <div className="relative border-4 border-[#333] bg-[#0a0a0a] shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          className="cursor-crosshair"
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState === 'start' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center"
            >
              <h2 className="text-2xl mb-8 text-[#FFFF55]">Ready to Puff?</h2>
              <button
                onClick={initGame}
                className="group relative px-8 py-3 bg-[#55FF55] text-black font-bold uppercase tracking-widest hover:bg-[#44cc44] transition-colors"
              >
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-white" />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white" />
                Start Game
              </button>
            </motion.div>
          )}

          {gameState === 'gameover' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center"
            >
              <h2 className="text-3xl mb-2 text-[#FF5555] font-black italic">GAME OVER</h2>
              <div className="mb-8">
                <p className="text-sm opacity-60 mb-1 uppercase">Final Score</p>
                <p className="text-4xl font-bold text-[#FFFF55]">{score}</p>
              </div>
              <button
                onClick={initGame}
                className="flex items-center gap-2 px-6 py-3 border-2 border-[#55FF55] text-[#55FF55] hover:bg-[#55FF55] hover:text-black transition-all font-bold uppercase"
              >
                <RotateCcw size={20} />
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Vintage Scanlines Effect */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
    </div>
  );
}
