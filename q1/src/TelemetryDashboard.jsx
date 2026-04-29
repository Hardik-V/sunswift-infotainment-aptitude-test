/**
 * APPROACH SUMMARY:
 * I implemented a modular architecture separating data parsing (utils) from UI (components). 
 * The data pipeline uses a multi-pass approach to identify outliers and interpolate missing 
 * values, ensuring a smooth visual experience while maintaining audit transparency. 
 * The UI utilizes custom SVG gauges with skeuomorphic detailing and 
 * synchronized state management to allow real-time scrubbing of the historical timeline.
 * 
 * TO-DO:
 * Split the project into modules to keep the UI from getting bloated—heavy lifting stays in 
 * /utils while the visual stuff lives in /components.
 */
import React, { useMemo, useState, useCallback } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Pulling in our specialized logic and components
import rawData from "./telemetry_sample.json";
import { cleanTelemetry } from "./utils/telemetryParser";
import PrecisionGauge from "./components/PrecisionGauge";

// Custom scrubber to make the timeline feel like a playback tool
function ScrubTooltip({ active }) {
  if (!active) return null;
  return (
    <div style={styles.scrubberLine}>
      <div style={styles.scrubberDot} />
    </div>
  );
}

export default function TelemetryDashboard() {
  // Memoizing the cleanup so we don't re-calculate the entire 30s run on every hover
  const data = useMemo(() => cleanTelemetry(rawData), []);
  const [activeIndex, setActiveIndex] = useState(null);

  // Default to the last available data point if not scrubbing
  const displayData = activeIndex !== null ? data[activeIndex] : data[data.length - 1];

  const handleMouseMove = useCallback((state) => {
    if (state.isTooltipActive && state.activeTooltipIndex !== undefined) {
      setActiveIndex(state.activeTooltipIndex);
    }
  }, []);

  const handleMouseLeave = useCallback(() => setActiveIndex(null), []);

  // Calculate deltas to see how much our interpolation shifted the raw values
  const speedDelta = (displayData.rawSpeedNum !== null) 
    ? Math.abs(displayData.rawSpeedNum - displayData.speed).toFixed(2) 
    : "0.00";

  const batteryDelta = (displayData.rawBatteryDisplay !== null) 
    ? Math.abs(displayData.rawBatteryDisplay - displayData.battery).toFixed(2) 
    : "0.00";
  
  const tempDelta = (displayData.rawMotorTempDisplay !== null) 
    ? Math.abs(displayData.rawMotorTempDisplay - displayData.motorTemp).toFixed(2) 
    : "0.00";

  const isTempCritical = displayData.motorTemp !== null && displayData.motorTemp > 90;

  return (
    <div style={styles.dashboardBackground}>
      <div style={styles.hudWrapper}>
        
        {/* Main Header with GPS Readout */}
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

        {/* Triple-Dial Cluster */}
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

        {/* Audit Log & System Alerts */}
        <div style={styles.midSection}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", position: "relative" }}>
            
            {/* Alert pops in when Δ is detected across any sensor */}
            <div style={{
              ...styles.warningPill,
              opacity: (parseFloat(speedDelta) !== 0 || parseFloat(batteryDelta) !== 0 || parseFloat(tempDelta) !== 0) ? 1 : 0,
            }}>
              ⚠ SENSOR ANOMALY DETECTED // DATA INTERPOLATED
            </div>

            <div style={styles.auditLogHorizontal}>
              {/* SPEED AUDIT */}
              <div style={styles.logColumn}>
                <div style={styles.columnHeader}>SPEED (KM/H)</div>
                <div style={styles.logGrid}>
                  <span style={styles.logLabel}>RAW:</span> <span style={{ color: "#a0c8ff" }}>{displayData.rawSpeedDisplay}</span>
                  <span style={styles.logLabel}>INT:</span> <span style={{ color: "#fff" }}>{displayData.speed.toFixed(1)}</span>
                  <span style={styles.logLabel}>Δ:</span>   <span style={{ color: parseFloat(speedDelta) !== 0 ? "#fbbf24" : "#8a939b" }}>{speedDelta}</span>
                </div>
              </div>

              <div style={styles.verticalDivider} />

              {/* BATTERY AUDIT */}
              <div style={styles.logColumn}>
                <div style={styles.columnHeader}>BATTERY (%)</div>
                <div style={styles.logGrid}>
                  <span style={styles.logLabel}>RAW:</span> <span style={{ color: "#a0c8ff" }}>{displayData.rawBatteryDisplay}</span>
                  <span style={styles.logLabel}>INT:</span> <span style={{ color: "#fff" }}>{displayData.battery.toFixed(1)}</span>
                  <span style={styles.logLabel}>Δ:</span>   <span style={{ color: parseFloat(batteryDelta) !== 0 ? "#fbbf24" : "#8a939b" }}>{batteryDelta}</span>
                </div>
              </div>

              <div style={styles.verticalDivider} />

              {/* TEMPERATURE AUDIT */}
              <div style={styles.logColumn}>
                <div style={styles.columnHeader}>TEMPERATURE (°C)</div>
                <div style={styles.logGrid}>
                  <span style={styles.logLabel}>RAW:</span> <span style={{ color: "#a0c8ff" }}>{displayData.rawMotorTempDisplay}</span>
                  <span style={styles.logLabel}>INT:</span> <span style={{ color: "#fff" }}>{displayData.motorTemp.toFixed(1)}</span>
                  <span style={styles.logLabel}>Δ:</span>   <span style={{ color: parseFloat(tempDelta) !== 0 ? "#fbbf24" : "#8a939b" }}>{tempDelta}</span>
                </div>
              </div>

              {isTempCritical && (
                <div style={styles.alertBannerFloating}>
                  !!! CRITICAL TEMP
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Telemetry Graph */}
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
                allowDataOverflow={true} 
                ticks={[60, 70, 80, 90]}
                stroke="#5c636a" tick={{ fontSize: 12, fill: "#8a939b" }} tickLine={false} axisLine={false}
              />
              <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} content={<ScrubTooltip />} />
              
              {/* Interpolated Trendline */}
              <Area 
                type="monotone" dataKey="speed" 
                stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSpeed)" 
                activeDot={{ r: 6, fill: "#fff", stroke: "#3b82f6", strokeWidth: 3 }}
                animationDuration={0} 
              />
              
              {/* RAW DATA DOTS: Plotted directly over the clean curve for visual auditing */}
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

// Styles

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
    maxWidth: "1050px",
    backgroundColor: "#0d0e12",
    borderRadius: "4px",
    padding: "60px 40px",
    border: "1px solid #1f2229",
    backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)",
    backgroundSize: "100% 3px",
    boxShadow: "0 40px 100px rgba(0,0,0,0.9)",
    position: "relative",
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
    bottom: "100%",                           
    left: 0,
    marginBottom: "10px",                     
    width: "100%",                            
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
    transition: "opacity 0.2s ease-in-out",
    pointerEvents: "none",  
    zIndex: 1000,
                     
  },
  midSection: {
    display: "flex",
    padding: "0 10px",
    marginBottom: "40px",
    minHeight: "80px",
    width: "100%",
  },
  auditLogHorizontal: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#181a20",
    border: "1px solid #2a2d35",
    borderLeft: "4px solid #3b82f6", 
    padding: "12px 10px",
    borderRadius: "0 4px 4px 0",
    fontFamily: "monospace",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    width: "100%",
    boxSizing: "border-box",
    position: "relative",
  },
  logColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flex: 1,
    padding: "0 15px",
  },
  columnHeader: {
    color: "#fff",
    fontSize: "9px",
    fontWeight: "bold",
    letterSpacing: "0.1em",
    opacity: 0.6,
  },
  logGrid: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    columnGap: "15px",
    fontSize: "11px",
    lineHeight: "1.2",
  },
  logLabel: {
    color: "#8a939b",
  },
  verticalDivider: {
    width: "1px",
    height: "35px",
    backgroundColor: "#2a2d35",
    opacity: 0.5,
  },
  alertBannerFloating: {
    position: "absolute",
    right: "15px",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    border: "1px solid #ef4444",
    color: "#ef4444",
    padding: "4px 10px",
    borderRadius: "4px",
    fontWeight: "bold",
    fontSize: "10px",
    letterSpacing: "0.05em",
    animation: "pulse 1.5s infinite",
  },
};