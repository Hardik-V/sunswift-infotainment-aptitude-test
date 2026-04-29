import React, { useMemo, useState, useCallback } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import rawData from "./telemetry_sample.json";
import { cleanTelemetry } from "./utils/telemetryParser";
import PrecisionGauge from "./components/PrecisionGauge";

function ScrubTooltip({ active }) {
  if (!active) return null;
  return (
    <div style={styles.scrubberLine}>
      <div style={styles.scrubberDot} />
    </div>
  );
}

export default function TelemetryDashboard() {
  const data = useMemo(() => cleanTelemetry(rawData), []);
  const [activeIndex, setActiveIndex] = useState(null);

  const displayData = activeIndex !== null ? data[activeIndex] : data[data.length - 1];

  const handleMouseMove = useCallback((state) => {
    if (state.isTooltipActive && state.activeTooltipIndex !== undefined) {
      setActiveIndex(state.activeTooltipIndex);
    }
  }, []);

  const handleMouseLeave = useCallback(() => setActiveIndex(null), []);

  const delta = (displayData.rawSpeedNum !== null && displayData.speed !== null) 
    ? Math.abs(displayData.rawSpeedNum - displayData.speed).toFixed(2) 
    : "N/A";

  const isTempCritical = displayData.motorTemp !== null && displayData.motorTemp > 90;

  return (
    <div style={styles.dashboardBackground}>
      <div style={styles.hudWrapper}>
        
        {/* Brushed Metal Header */}
        <div style={styles.header}>
          <div style={styles.brandText}>SUNSWIFT // TELEMETRY // Q1 DASHBOARD</div>
          <div style={styles.subText}>
            GPS: {displayData.gps ? (
              `${displayData.gps.lat.toFixed(4)}, ${displayData.gps.lng.toFixed(4)}`
            ) : (
              <span style={{ color: "#ef4444", fontWeight: "bold", letterSpacing: "0.15em" }}>SIGNAL LOST</span>
            )}
          </div>
        </div>

        {/* Instruments Row */}
        <div style={styles.dialsRow}>
          <PrecisionGauge 
            value={displayData.battery} max={100} 
            ticks={[0, 20, 40, 60, 80, 100]}
            label="BATTERY" unit="%" color="#03ff96" size={240}
          />
          <PrecisionGauge 
            value={displayData.speed} max={160} 
            ticks={[0, 20, 40, 60, 80, 100, 120, 140, 160]}
            label="SPEED" unit="KM/H" color="#ff7300" size={320} isCenter={true}
          />
          <PrecisionGauge 
            value={displayData.motorTemp} max={120} 
            ticks={[0, 30, 60, 90, 120]}
            label="TEMP" unit="°C" color="#0099ff" size={240}
            isAlert={isTempCritical}
          />
        </div>

        {/* Audit Log & Alerts */}
        <div style={styles.midSection}>
          
          {/* Left Side: Audit Log & Interpolation Warning */}
          <div style={{ position: "relative" }}>
            
            {/* Smooth Fade-in Warning Pill (Absolute Positioned) */}
            <div style={{
              ...styles.warningPill,
              opacity: parseFloat(delta) !== 0 ? 1 : 0,
            }}>
              !! DATA INTERPOLATED
            </div>

            <div style={styles.auditLog}>
              <div style={{ color: "#fff", marginBottom: "8px", fontWeight: "bold" }}>AUDIT LOG</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>RAW_SPD:</span> <span style={{ color: "#a0c8ff" }}>{displayData.rawSpeedDisplay}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>INT_SPD:</span> <span style={{ color: "#fff" }}>{displayData.speed ? displayData.speed.toFixed(1) : "N/A"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>DELTA:</span> <span style={{ color: parseFloat(delta) > 0 ? "#fbbf24" : "#8a939b" }}>{delta}</span>
              </div>
            </div>

          </div>
          
          {/* Right Side: Critical Temp Banner */}
          {isTempCritical && (
            <div style={styles.alertBanner}>
              !!! CRITICAL MOTOR TEMPERATURE EXCEEDED
            </div>
          )}
          
        </div>

        {/* Timeline Chart */}
        <div style={styles.chartWrapper}>
          <div style={styles.chartHeader}>↑ Speed (km/h)</div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart 
              data={data} 
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
            >
              <defs>
                <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2a2d35" vertical={true} horizontal={true} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(t) => `${Math.round((t - data[0].timestamp) / 1000)}`}
                stroke="#5c636a" tick={{ fontSize: 12, fill: "#8a939b" }} tickLine={false} axisLine={false}
              />
              <YAxis 
                domain={[60, 95]} 
                allowDataOverflow={true} // Prevents the raw 300 data point from flattening the graph
                ticks={[60, 70, 80, 90]}
                stroke="#5c636a" tick={{ fontSize: 12, fill: "#8a939b" }} tickLine={false} axisLine={false}
              />
              <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} content={<ScrubTooltip />} />
              
              {/* The clean interpolated area chart */}
              <Area 
                type="monotone" dataKey="speed" 
                stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSpeed)" 
                activeDot={{ r: 6, fill: "#fff", stroke: "#3b82f6", strokeWidth: 3 }}
                animationDuration={0} 
              />
              
              {/* Overlay raw data as discrete dots for auditing */}
              <Line 
                type="monotone" dataKey="rawSpeedNum" 
                stroke="none" 
                dot={{ r: 3, fill: "rgba(255,255,255,0.4)", strokeWidth: 0 }} 
                activeDot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}

// --- Styles ---

const styles = {
  dashboardBackground: {
    minHeight: "100vh",
    backgroundColor: "#111216",
    backgroundImage: `repeating-linear-gradient(45deg, #0d0e12 25%, transparent 25%, transparent 75%, #0d0e12 75%, #0d0e12), repeating-linear-gradient(45deg, #0d0e12 25%, #15161a 25%, #15161a 75%, #0d0e12 75%, #0d0e12)`,
    backgroundPosition: `0 0, 8px 8px`,
    backgroundSize: `16px 16px`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    padding: "20px",
  },
  hudWrapper: {
    width: "100%",
    maxWidth: "1000px",
    backgroundColor: "rgba(21, 22, 26, 0.85)", 
    borderRadius: "12px",
    padding: "40px",
    border: "1px solid #2a2d35",
    boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
  },
  header: {
    background: "linear-gradient(180deg, #d3d5d7 0%, #a8a9ad 20%, #8b8e91 50%, #686b6d 100%)",
    padding: "16px",
    textAlign: "center",
    marginBottom: "50px",
    borderRadius: "4px",
    border: "1px solid #4a4f5c",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 5px 15px rgba(0,0,0,0.5)",
  },
  brandText: {
    fontSize: "22px",
    fontWeight: 800,
    letterSpacing: "0.2em",
    color: "#fff",
    textShadow: "0 2px 4px rgba(0,0,0,0.6)",
  },
  subText: {
    fontSize: "11px",
    fontFamily: "monospace",
    color: "#e2e2e2",
    marginTop: "4px",
    letterSpacing: "0.1em",
    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
  },
  dialsRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "35px", 
    marginBottom: "30px",
  },
  midSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 20px",
    marginBottom: "30px",
    minHeight: "85px",
  },
  auditLog: {
    backgroundColor: "rgba(20, 21, 26, 0.95)",
    border: "1px solid #4a4f5c",
    padding: "12px 16px",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#8a939b",
    lineHeight: "1.6",
    minWidth: "220px",
    boxShadow: "0 10px 20px rgba(0,0,0,0.4)",
  },
  alertBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    border: "1px solid #ef4444",
    color: "#ef4444",
    padding: "16px 24px",
    borderRadius: "4px",
    fontWeight: "bold",
    letterSpacing: "0.1em",
    fontSize: "14px",
  },
  chartWrapper: {
    backgroundColor: "#111216",
    padding: "16px",
    borderRadius: "8px",
    border: "1px solid #2a2d35",
  },
  chartHeader: {
    color: "#fff",
    fontSize: "12px",
    marginBottom: "10px",
    marginLeft: "10px",
  },
  scrubberLine: {
    height: "100%",
    position: "relative",
  },
  scrubberDot: {
    position: "absolute",
    top: -6,
    left: -6,
    width: 12,
    height: 12,
    backgroundColor: "#ffffff",
    borderRadius: "50%",
    boxShadow: "0 0 12px #3b82f6",
  },
  warningPill: {
    position: "absolute",
    bottom: "100%",                           // Pins it exactly to the top of the Audit Log
    left: 0,
    marginBottom: "10px",                     // Creates the gap
    width: "100%",                            // Matches the Audit Log width perfectly
    boxSizing: "border-box",
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    border: "1px solid #fbbf24",                 
    color: "#fbbf24",                            
    padding: "6px 12px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textAlign: "center",
    transition: "opacity 0.2s ease-in-out",   // The smooth fade effect
    pointerEvents: "none",                    // Prevents it from blocking mouse clicks when hidden
  },
};