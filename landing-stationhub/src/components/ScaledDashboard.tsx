import { useEffect, useRef, useState, type ReactNode } from 'react';

const DESIGN_WIDTH = 896;

export function ScaledDashboard({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const update = () => {
      const w = container.offsetWidth;
      const s = w / DESIGN_WIDTH;
      setScale(s);
      setHeight(inner.offsetHeight * s);
    };

    const ro = new ResizeObserver(update);
    ro.observe(container);
    update();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ height }} className="relative w-full">
      <div
        ref={innerRef}
        style={{
          width: DESIGN_WIDTH,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
