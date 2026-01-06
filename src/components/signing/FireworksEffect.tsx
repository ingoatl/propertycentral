import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface FireworkParticle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  color: string;
  size: number;
  delay: number;
}

interface Firework {
  id: number;
  x: number;
  y: number;
  particles: FireworkParticle[];
}

const COLORS = [
  "#fae052", // Yellow (brand)
  "#10b981", // Green (success)
  "#f97316", // Orange
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#ef4444", // Red
  "#22c55e", // Bright green
];

function createFirework(id: number): Firework {
  const x = 10 + Math.random() * 80; // 10-90% of screen width
  const y = 20 + Math.random() * 40; // 20-60% of screen height
  
  const particles: FireworkParticle[] = [];
  const numParticles = 12 + Math.floor(Math.random() * 8);
  const baseColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  
  for (let i = 0; i < numParticles; i++) {
    particles.push({
      id: i,
      x: 0,
      y: 0,
      angle: (360 / numParticles) * i + (Math.random() * 20 - 10),
      speed: 60 + Math.random() * 40,
      color: baseColor,
      size: 3 + Math.random() * 3,
      delay: Math.random() * 0.1,
    });
  }
  
  return { id, x, y, particles };
}

export function FireworksEffect({ show, onComplete }: { show: boolean; onComplete?: () => void }) {
  const [fireworks, setFireworks] = useState<Firework[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!show) {
      setIsVisible(false);
      setFireworks([]);
      return;
    }

    setIsVisible(true);

    // Create initial burst
    const initial = [
      createFirework(0),
      createFirework(1),
      createFirework(2),
    ];
    setFireworks(initial);

    // Add more fireworks over time
    const timeouts: NodeJS.Timeout[] = [];
    
    for (let i = 0; i < 6; i++) {
      const timeout = setTimeout(() => {
        setFireworks(prev => [...prev, createFirework(prev.length)]);
      }, 300 + i * 400);
      timeouts.push(timeout);
    }

    // Auto-hide after animation completes
    const hideTimeout = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 4000);
    timeouts.push(hideTimeout);

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [show, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {fireworks.map(fw => (
        <div
          key={fw.id}
          className="absolute"
          style={{
            left: `${fw.x}%`,
            top: `${fw.y}%`,
          }}
        >
          {fw.particles.map(p => (
            <div
              key={p.id}
              className="absolute rounded-full animate-firework-particle"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                '--angle': `${p.angle}deg`,
                '--speed': `${p.speed}px`,
                '--delay': `${p.delay}s`,
                animationDelay: `${p.delay}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      ))}
      
      {/* Confetti overlay */}
      <div className="absolute inset-0">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute animate-confetti"
            style={{
              left: `${Math.random() * 100}%`,
              top: '-10px',
              width: `${6 + Math.random() * 6}px`,
              height: `${6 + Math.random() * 6}px`,
              backgroundColor: COLORS[Math.floor(Math.random() * COLORS.length)],
              borderRadius: Math.random() > 0.5 ? '50%' : '0',
              transform: `rotate(${Math.random() * 360}deg)`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default FireworksEffect;
