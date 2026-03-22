import type React from 'react';
import { useEffect, useState } from 'react';

interface LineInfo {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

interface DependencyLinesProps {
  lines: LineInfo[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

// Generate distinct colors using HSL
export const getDepColor = (index: number, total: number): string => {
  const hue = ((index * 360) / Math.max(total, 1)) % 360;
  return `hsl(${hue}, 70%, 55%)`;
};

const DependencyLines: React.FC<DependencyLinesProps> = ({
  lines,
  containerRef,
}) => {
  const [containerBounds, setContainerBounds] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        setContainerBounds(containerRef.current.getBoundingClientRect());
      }
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds, true);

    return () => {
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds, true);
    };
  }, [containerRef]);

  if (!containerBounds || lines.length === 0) return null;

  return (
    <svg
      className="dependency-lines-svg"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <defs>
        {lines.map((_, idx) => (
          <marker
            key={`circle-${idx}`}
            id={`arrowhead-${idx}`}
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
          >
            <circle cx="4" cy="4" r="3" fill={lines[idx].color} />
          </marker>
        ))}
      </defs>
      {lines.map((line, idx) => {
        // Calculate control points for smooth bezier curve
        const midX = (line.startX + line.endX) / 2;
        const controlPoint1X = midX;
        const controlPoint1Y = line.startY;
        const controlPoint2X = midX;
        const controlPoint2Y = line.endY;

        const pathD = `M ${line.startX} ${line.startY} 
                       C ${controlPoint1X} ${controlPoint1Y}, 
                         ${controlPoint2X} ${controlPoint2Y}, 
                         ${line.endX} ${line.endY}`;

        return (
          <g key={idx}>
            {/* Shadow for better visibility */}
            <path
              d={pathD}
              fill="none"
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Main line */}
            <path
              d={pathD}
              fill="none"
              stroke={line.color}
              strokeWidth="2"
              strokeLinecap="round"
              markerEnd={`url(#arrowhead-${idx})`}
            />
            {/* Start point circle removed as requested */}
          </g>
        );
      })}
    </svg>
  );
};

export default DependencyLines;
