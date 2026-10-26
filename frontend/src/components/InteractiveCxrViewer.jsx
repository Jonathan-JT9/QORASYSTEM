import { useState, useRef, useEffect, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Move,
  Maximize2
} from "lucide-react";

export default function InteractiveCxrViewer({
  src,
  alt = "Chest X-Ray",
  label = "Chest X-Ray",
  aspectRatio = "aspect-square"
}) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(Number((prev + 0.3).toFixed(2)), 3.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(Number((prev - 0.3).toFixed(2)), 1);
      if (next === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handleRotateLeft = useCallback(() => {
    setRotation((prev) => prev - 90);
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotation((prev) => prev + 90);
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  // Mouse pan handlers
  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || scale <= 1) return;
    const maxOffset = (scale - 1) * 200;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    // Bound the panning so image stays visible
    setPosition({
      x: Math.max(Math.min(newX, maxOffset), -maxOffset),
      y: Math.max(Math.min(newY, maxOffset), -maxOffset)
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch pan handlers for mobile
  const handleTouchStart = (e) => {
    if (scale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y
    });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || scale <= 1 || e.touches.length !== 1) return;
    const maxOffset = (scale - 1) * 200;
    const newX = e.touches[0].clientX - dragStart.x;
    const newY = e.touches[0].clientY - dragStart.y;
    setPosition({
      x: Math.max(Math.min(newX, maxOffset), -maxOffset),
      y: Math.max(Math.min(newY, maxOffset), -maxOffset)
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Keyboard accessibility
  const handleKeyDown = (e) => {
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      handleZoomIn();
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      handleZoomOut();
    } else if (e.key === "0" || e.key === "r" || e.key === "R") {
      e.preventDefault();
      handleReset();
    } else if (scale > 1) {
      const step = 20;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPosition((p) => ({ ...p, x: p.x + step }));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPosition((p) => ({ ...p, x: p.x - step }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setPosition((p) => ({ ...p, y: p.y + step }));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setPosition((p) => ({ ...p, y: p.y - step }));
      }
    }
  };

  // Double click toggles zoom
  const handleDoubleClick = () => {
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-sm">
      {/* Top status bar */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-100/80 px-4 py-2.5 text-xs">
        <span className="font-bold tracking-tight text-neutral-800">
          {label}
        </span>
        <div className="flex items-center gap-1.5 text-neutral-500">
          <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-black border border-neutral-200">
            {Math.round(scale * 100)}%
          </span>
          {rotation !== 0 && (
            <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 border border-neutral-200">
              {((rotation % 360) + 360) % 360}°
            </span>
          )}
        </div>
      </div>

      {/* Interactive viewport */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="region"
        aria-label={`Viewer citra interaktif untuk ${alt}. Gunakan tombol toolbar atau keyboard (+, -, tombol panah) untuk navigasi.`}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        className={`relative ${aspectRatio} w-full overflow-hidden bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-black ${
          scale > 1
            ? isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-zoom-in"
        }`}
      >
        <div
          className="flex h-full w-full items-center justify-center transition-transform duration-100 ease-out select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`
          }}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="h-full w-full object-contain pointer-events-none"
          />
        </div>

        {/* Pan helper notification */}
        {scale > 1 && (
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm shadow-md animate-fade-in">
            <Move className="h-3.5 w-3.5" />
            <span>Geser untuk melihat detail</span>
          </div>
        )}
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-2.5">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 1}
            aria-label="Perkecil gambar (Zoom Out)"
            title="Perkecil (Zoom Out)"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-800 transition-all hover:border-black hover:bg-neutral-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3.5}
            aria-label="Perbesar gambar (Zoom In)"
            title="Perbesar (Zoom In)"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-800 transition-all hover:border-black hover:bg-neutral-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Rotate and Reset Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRotateLeft}
            aria-label="Putar kiri 90 derajat"
            title="Putar Kiri 90°"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-800 transition-all hover:border-black hover:bg-neutral-100 active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleRotateRight}
            aria-label="Putar kanan 90 derajat"
            title="Putar Kanan 90°"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-800 transition-all hover:border-black hover:bg-neutral-100 active:scale-95"
          >
            <RotateCw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={scale === 1 && rotation === 0 && position.x === 0 && position.y === 0}
            aria-label="Reset zoom, posisi, dan rotasi"
            title="Reset Tampilan"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 h-8 text-xs font-semibold text-neutral-800 transition-all hover:border-black hover:bg-neutral-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
