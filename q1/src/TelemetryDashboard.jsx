/*
 * TelemetryDashboard.jsx — Sunswift Infotainment Q1
 *
 * Approach: I first wrote a two-pass cleaning pipeline — pass one coerces every
 * field to the correct type (stripping units like "%" or "C", catching "NaN"
 * strings, nulling anything unparseable), then pass two detects outliers by
 * comparing each speed reading against its neighbours; values that deviate by
 * more than 20 km/h from the local average are treated as sensor glitches and
 * replaced with linear interpolation. I chose interpolation over removal so the
 * chart stays continuous and the timestamp axis remains uniform. For the display
 * I used a Recharts LineChart (clean API, no heavy dependency), and kept styling
 * intentionally minimal — a dark race-HUD palette with a single red alert for
 * motorTemp > 90 °C so critical warnings are impossible to miss at a glance.
 */

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import rawData from "./telemetry_sample.json";

// Data Cleaning

/**
 * Coerce any value to a finite number, or return null.
 * Handles: numbers, numeric strings, strings with trailing units ("72C", "72.6%").
 */
function toNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isFinite(val) ? val : null;
  if (typeof val === "string") {
    if (val.trim().toLowerCase() === "nan") return null;
    const stripped = val.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(stripped);
    return isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Validate a GPS object — must have finite lat and lng numbers.
 */
function toGps(val) {
  if (!val || typeof val !== "object") return null;
  const lat = toNumber(val.lat);
  const lng = toNumber(val.lng);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

/**
 * Linear interpolation between two numbers.
 */
function lerp(a, b) {
  return (a + b) / 2;
}

/**
 * Full two-pass cleaning pipeline.
 *
 * Pass 1 — type coercion: parse every field to its target type.
 * Pass 2 — outlier detection: for speed, if a value deviates more than
 *   OUTLIER_THRESHOLD km/h from the average of its neighbours it is flagged as
 *   a sensor glitch and replaced with the interpolated value.
 *
 * Outlier rationale:
 *   - speed = 40 surrounded by ~73 km/h values → clearly a momentary dropout,
 *     not a real deceleration (would require ~170 m/s² deceleration).
 *   - speed = 300 → physically impossible for Sunswift; treated identically.
 *   Both are replaced with the average of their neighbours so the chart stays
 *   continuous without introducing gaps in the time series.
 */
const OUTLIER_THRESHOLD = 20; // km/h deviation from neighbour average
const SPEED_MAX = 200;         // hard upper clamp as a safety net

function cleanTelemetry(raw) {
  // Pass 1: coerce types
  const coerced = raw.map((entry) => ({
    timestamp: entry.timestamp,
    speed: toNumber(entry.speed),
    battery: toNumber(entry.battery),
    motorTemp: toNumber(entry.motorTemp),
    gps: toGps(entry.gps),
  }));

  // Pass 2: outlier interpolation on speed
  const cleaned = coerced.map((entry, i) => {
    let speed = entry.speed;

    // Hard clamp
    if (speed !== null && speed > SPEED_MAX) speed = null;

    // Outlier detection — needs valid neighbours
    if (speed !== null && i > 0 && i < coerced.length - 1) {
      const prev = coerced[i - 1].speed;
      const next = coerced[i + 1].speed;
      if (prev !== null && next !== null) {
        const neighbourAvg = (prev + next) / 2;
        if (Math.abs(speed - neighbourAvg) > OUTLIER_THRESHOLD) {
          speed = null; // flag for interpolation below
        }
      }
    }

    return { ...entry, speed };
  });

  // Pass 2b: fill null speeds with linear interpolation
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i].speed === null) {
      // Find nearest valid neighbours
      let prevIdx = i - 1;
      let nextIdx = i + 1;
      while (prevIdx >= 0 && cleaned[prevIdx].speed === null) prevIdx--;
      while (nextIdx < cleaned.length && cleaned[nextIdx].speed === null) nextIdx++;

      const prevSpeed = prevIdx >= 0 ? cleaned[prevIdx].speed : null;
      const nextSpeed = nextIdx < cleaned.length ? cleaned[nextIdx].speed : null;

      if (prevSpeed !== null && nextSpeed !== null) {
        cleaned[i].speed = lerp(prevSpeed, nextSpeed);
      } else if (prevSpeed !== null) {
        cleaned[i].speed = prevSpeed;
      } else if (nextSpeed !== null) {
        cleaned[i].speed = nextSpeed;
      }
      // If still null, leave as null — fallback UI will handle it
    }
  }

  return cleaned;
}

// Sub-components

/** Single stat tile — shows label + value, with optional warning colour. */
function StatCard({ label, value, unit, warn = false }) {
  const displayValue = value !== null && value !== undefined
    ? `${typeof value === "number" ? value.toFixed(1) : value}${unit}`
    : "N/A";

  return (
    <div style={{
      ...styles.card,
      borderColor: warn ? "#ff3b3b" : "#2a2a2a",
      boxShadow: warn ? "0 0 12px rgba(255,59,59,0.35)" : "none",
    }}>
      <span style={styles.cardLabel}>{label}</span>
      <span style={{ ...styles.cardValue, color: warn ? "#ff3b3b" : "#e8e8e8" }}>
        {displayValue}
      </span>
      {warn && <span style={styles.warnBadge}>⚠ HIGH TEMP</span>}
    </div>
  );
}

/** Custom tooltip for the chart. */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={styles.tooltip}>
      <p style={{ color: "#aaa", margin: 0, fontSize: 11 }}>
        t+{Math.round((label - rawData[0].timestamp) / 1000)}s
      </p>
      <p style={{ color: "#00e5ff", margin: 0, fontWeight: 700 }}>
        {payload[0].value?.toFixed(1)} km/h
      </p>
    </div>
  );
}

// Main Component

export default function TelemetryDashboard() {
  const data = useMemo(() => cleanTelemetry(rawData), []);

  // Most recent entry for the live readouts
  const latest = data[data.length - 1];

  const tempWarn = latest.motorTemp !== null && latest.motorTemp > 90;

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <span style={styles.headerBrand}>SUNSWIFT</span>
        <span style={styles.headerTitle}>TELEMETRY</span>
        <span style={styles.headerSub}>30s SNAPSHOT</span>
      </header>

      {/* Live stat cards */}
      <section style={styles.cardRow}>
        <StatCard
          label="SPEED"
          value={latest.speed}
          unit=" km/h"
        />
        <StatCard
          label="BATTERY"
          value={latest.battery}
          unit="%"
        />
        <StatCard
          label="MOTOR TEMP"
          value={latest.motorTemp}
          unit=" °C"
          warn={tempWarn}
        />
      </section>

      {/* Speed / time chart */}
      <section style={styles.chartSection}>
        <p style={styles.chartLabel}>SPEED  ·  km/h  over  30 s</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#1e1e1e" strokeDasharray="4 4" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(t) => `${Math.round((t - data[0].timestamp) / 1000)}s`}
              tick={{ fill: "#555", fontSize: 11, fontFamily: "monospace" }}
              axisLine={{ stroke: "#2a2a2a" }}
              tickLine={false}
            />
            <YAxis
              domain={[60, 90]}
              tick={{ fill: "#555", fontSize: 11, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={80} stroke="#333" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="speed"
              stroke="#00e5ff"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#00e5ff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* GPS fallback info */}
      <section style={styles.gpsRow}>
        <span style={styles.cardLabel}>GPS</span>
        {latest.gps ? (
          <span style={styles.gpsValue}>
            {latest.gps.lat.toFixed(4)}, {latest.gps.lng.toFixed(4)}
          </span>
        ) : (
          <span style={{ ...styles.gpsValue, color: "#555" }}>No fix</span>
        )}
      </section>
    </div>
  );
}

// Styles

const styles = {
  root: {
    minHeight: "100vh",
    background: "#080808",
    color: "#e8e8e8",
    fontFamily: "'Courier New', Courier, monospace",
    padding: "32px 24px",
    maxWidth: 760,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 32,
    borderBottom: "1px solid #1e1e1e",
    paddingBottom: 16,
  },
  headerBrand: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "0.18em",
    color: "#00e5ff",
  },
  headerTitle: {
    fontSize: 13,
    letterSpacing: "0.25em",
    color: "#666",
  },
  headerSub: {
    marginLeft: "auto",
    fontSize: 11,
    color: "#333",
    letterSpacing: "0.1em",
  },
  cardRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 32,
  },
  card: {
    background: "#0f0f0f",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  cardLabel: {
    fontSize: 10,
    letterSpacing: "0.2em",
    color: "#555",
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 1,
  },
  warnBadge: {
    fontSize: 10,
    color: "#ff3b3b",
    letterSpacing: "0.12em",
    marginTop: 4,
  },
  chartSection: {
    background: "#0f0f0f",
    border: "1px solid #1e1e1e",
    borderRadius: 4,
    padding: "20px 16px 16px",
    marginBottom: 16,
  },
  chartLabel: {
    fontSize: 10,
    letterSpacing: "0.2em",
    color: "#444",
    marginBottom: 12,
    marginTop: 0,
  },
  tooltip: {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 3,
    padding: "8px 12px",
  },
  gpsRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "12px 16px",
    background: "#0f0f0f",
    border: "1px solid #1e1e1e",
    borderRadius: 4,
  },
  gpsValue: {
    fontSize: 13,
    color: "#888",
    letterSpacing: "0.05em",
  },
};