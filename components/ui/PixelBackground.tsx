"use client"

import React, { useEffect, useRef } from 'react';

export const PixelBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        // Tiny squares - dense grid
        const pixelSize = 4;
        const gap = 2;
        const step = pixelSize + gap;

        // Palette: Deep Blue, Cyan, Grey, and now White/Light Grey
        const getGridColor = () => {
            const r = Math.random();
            if (r > 0.998) return '#ffffff'; // White (Sparkle)
            if (r > 0.99) return '#d4d4d8'; // Zinc-300 (Light Gray)
            if (r > 0.985) return '#a1a1aa'; // Zinc-400 (Mid Gray)

            if (r > 0.975) return '#22d3ee'; // Cyan-400 (Brightest Accent)
            if (r > 0.96) return '#0ea5e9'; // Sky-500 (Bright Blue)
            if (r > 0.93) return '#0891b2'; // Cyan-600

            if (r > 0.85) return '#1e3a8a'; // Blue-900 (Deep Blue)

            if (r > 0.70) return '#27272a'; // Zinc-800 (Lighter Background Grey)
            if (r > 0.50) return '#18181b'; // Zinc-900 (Grey)
            if (r > 0.30) return '#09090b'; // Zinc-950 (Darker Grey)

            return 'transparent'; // Empty/Black
        };

        let cols = 0;
        let rows = 0;

        // Store grid state
        let grid: { color: string; nextUpdate: number }[] = [];

        const initGrid = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            }

            cols = Math.ceil(canvas.width / step);
            rows = Math.ceil(canvas.height / step);

            grid = new Array(cols * rows).fill(null).map(() => ({
                color: getGridColor(),
                nextUpdate: Math.random() * 500
            }));
        };

        const draw = (time: number) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    const index = i + j * cols;
                    const cell = grid[index];

                    if (time > cell.nextUpdate) {
                        if (Math.random() > 0.95) { // 5% chance to change per update cycle
                            cell.color = getGridColor();
                        }
                        cell.nextUpdate = time + 50 + Math.random() * 300; // Fast flicker
                    }

                    if (cell.color !== 'transparent') {
                        ctx.fillStyle = cell.color;
                        ctx.fillRect(i * step, j * step, pixelSize, pixelSize);
                    }
                }
            }

            animationFrameId = requestAnimationFrame(draw);
        };

        const resize = () => {
            initGrid();
        };

        window.addEventListener('resize', resize);
        initGrid();
        requestAnimationFrame(draw);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-80 pointer-events-none" />;
};