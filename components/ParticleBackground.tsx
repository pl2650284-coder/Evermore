'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from './ThemeProvider';

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentCanvas = canvas;
    const currentCtx = ctx;

    let animationId: number;
    const particles: Particle[] = [];
    const particleCount = 50;

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;

      constructor() {
        this.x = Math.random() * currentCanvas.width;
        this.y = Math.random() * currentCanvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > currentCanvas.width) this.x = 0;
        if (this.x < 0) this.x = currentCanvas.width;
        if (this.y > currentCanvas.height) this.y = 0;
        if (this.y < 0) this.y = currentCanvas.height;
      }

      draw() {
        currentCtx.fillStyle = theme === 'light' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)';
        currentCtx.beginPath();
        currentCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        currentCtx.fill();
      }
    }

    const init = () => {
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const connectParticles = () => {
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x;
          const dy = particles[a].y - particles[b].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            const opacity = (1 - distance / 100) * 0.2;
            currentCtx.strokeStyle = theme === 'light'
              ? `rgba(0, 0, 0, ${opacity})`
              : `rgba(255, 255, 255, ${opacity})`;
            currentCtx.lineWidth = 1;
            currentCtx.beginPath();
            currentCtx.moveTo(particles[a].x, particles[a].y);
            currentCtx.lineTo(particles[b].x, particles[b].y);
            currentCtx.stroke();
          }
        }
      }
    };

    const animate = () => {
      currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);

      for (const particle of particles) {
        particle.update();
        particle.draw();
      }

      connectParticles();
      animationId = requestAnimationFrame(animate);
    };

    const resize = () => {
      currentCanvas.width = window.innerWidth;
      currentCanvas.height = window.innerHeight;
    };

    resize();
    init();
    animate();

    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10"
    />
  );
}
