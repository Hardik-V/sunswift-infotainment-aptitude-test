import React from "react";

/**
 * Converts polar coordinates to SVG Cartesian coordinates.
 * NOTE: SVG 0 degrees is at 3 o'clock. We subtract 90 so that 
 * our math treats 12 o'clock as the vertical 0 point.
 */
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  };
}

export default function PrecisionGauge({ value, max, label, unit, color, ticks, size = 260, isCenter = false, isAlert = false }) {
  const cx = size / 2;
  const cy = size / 2;
  const safeValue = value || 0;
  
  // Standard automotive sweep: -135deg (bottom-left) to +135deg (bottom-right).
  // This gives us that classic 270-degree instrument feel.
  const angle = -135 + (Math.min(Math.max(safeValue / max, 0), 1) * 270);
  
  const outerRadius = size * 0.42;
  const innerRadius = size * 0.35;
  const displayColor = isAlert ? "#ef4444" : color;

  // Generate the 60 minor ticks
  const minorTicks = [];
  for(let i = 0; i <= 60; i++) {
    const a = -135 + (i / 60) * 270;
    const p1 = polarToCartesian(cx, cy, outerRadius, a);
    const p2 = polarToCartesian(cx, cy, outerRadius - 4, a);
    minorTicks.push(<line key={`minor-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#4a4f5c" strokeWidth="1" />);
  }

  // Debugging the needle sweep if it clips
  // console.log(`[Gauge:${label}] Value: ${safeValue}, Calculated Angle: ${angle.toFixed(2)}deg`);

  return (
    <div style={{ ...styles.pod, width: size, height: size, zIndex: isCenter ? 10 : 1 }}>
      <svg width={size} height={size} style={{ position: "absolute" }}>
        
        {/* PHYSICAL BEZEL: Layering circles to create a machined look */}
        <circle cx={cx} cy={cy} r={outerRadius + 8} fill="#14151a" stroke={isAlert ? "#ef4444" : "#2a2d35"} strokeWidth="2" style={{ transition: "stroke 0.3s" }} />
        <circle cx={cx} cy={cy} r={outerRadius + 3} fill="transparent" stroke="#0a0a0c" strokeWidth="6" />

        {/* TICKS: Minor and Major markings */}
        {minorTicks}
        {ticks.map(tick => {
          const tickAngle = -135 + ((tick / max) * 270);
          const p1 = polarToCartesian(cx, cy, outerRadius, tickAngle);
          const p2 = polarToCartesian(cx, cy, innerRadius + 10, tickAngle);
          const textPos = polarToCartesian(cx, cy, innerRadius - 10, tickAngle);
          
          return (
            <g key={`major-${tick}`}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#8a939b" strokeWidth="2" />
              <text x={textPos.x} y={textPos.y} fill="#fff" fontSize={isCenter ? "14" : "12"} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fontFamily="monospace">
                {tick}
              </text>
            </g>
          );
        })}
        
        {/* NEEDLE: The transition here is crucial for that "smooth" motor feel */}
        <g style={{ transition: "transform 0.1s linear", transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${angle}deg)` }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - innerRadius} stroke={displayColor} strokeWidth={isCenter ? "5" : "3"} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${displayColor})`, transition: "stroke 0.3s" }} />
          <circle cx={cx} cy={cy} r={isCenter ? "14" : "10"} fill={displayColor} style={{ transition: "fill 0.3s" }} />
          <circle cx={cx} cy={cy} r={isCenter ? "6" : "4"} fill="#14151a" />
        </g>
      </svg>
      
      {/* TEXT OVERLAY: Positioned in the "lower hemisphere" safe-zone to avoid needle overlap */}
      <div style={{ 
        ...styles.podContent, 
        top: isCenter ? "58%" : "55%", 
        justifyContent: "flex-start" 
      }}>
        
        {/* Unit */}
        <div style={{ color: "#8a939b", fontSize: "12px", fontWeight: 600, letterSpacing: 1 }}>
          {unit}
        </div>

        <div style={{ color: displayColor, fontSize: isCenter ? "16px" : "12px", fontWeight: 800, letterSpacing: 1.5, marginTop: "2px" }}>
          {label}
        </div>

        {/* Using a fixed-width-ish layout here so the numbers don't jump when scrubbing */}
        <div style={{ color: isAlert ? "#ef4444" : "#fff", fontSize: isCenter ? "52px" : "34px", fontWeight: 700, lineHeight: 1, marginTop: "5px" }}>
          {value !== null ? value.toFixed(1) : "--"}
        </div>

      </div>
    </div>
  );
}

const styles = {
  pod: {
    position: "relative",
    borderRadius: "50%",
    backgroundColor: "#13141a",
    border: "2px solid #1f2229",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "inset 0 4px 20px rgba(0,0,0,0.5)",
  },
  podContent: {
    position: "absolute",
    left: 0,
    right: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    zIndex: 5,
  }
};