const SPEED_OUTLIER_THRESHOLD = 20;
const SPEED_MAX = 160;

function parseAndTag(val, type) {
  if (val === null || val === undefined) return { value: null, raw: "null", status: "missing" };
  if (typeof val === "string") {
    if (val.trim().toLowerCase() === "nan") return { value: null, raw: val, status: "corrupted" };
    const stripped = val.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(stripped);
    if (!isFinite(parsed)) return { value: null, raw: val, status: "corrupted" };
    if (type === "battery" && (parsed > 100 || parsed < 0)) return { value: null, raw: val, status: "corrupted" };
    return { value: parsed, raw: val, status: "corrupted" }; 
  }
  if (typeof val === "number") {
    if (!isFinite(val)) return { value: null, raw: val, status: "missing" };
    if (type === "battery" && (val > 100 || val < 0)) return { value: null, raw: val, status: "corrupted" };
    return { value: val, raw: val, status: "valid" };
  }
  return { value: null, raw: String(val), status: "missing" };
}

export function cleanTelemetry(raw) {
  const tagged = raw.map((entry) => {
    const speed = parseAndTag(entry.speed, "speed");
    const battery = parseAndTag(entry.battery, "battery");
    const motorTemp = parseAndTag(entry.motorTemp, "motorTemp");
    
    let gps = entry.gps;
    if (gps && (typeof gps.lat !== 'number' || typeof gps.lng !== 'number')) {
      gps = null;
    }

    const rawSpeedNum = typeof entry.speed === "number" && isFinite(entry.speed) ? entry.speed : null;

    return {
      timestamp: entry.timestamp,
      speed: speed.value,
      rawSpeedDisplay: speed.raw,
      rawSpeedNum: rawSpeedNum,
      battery: battery.value,
      motorTemp: motorTemp.value,
      gps: gps,
    };
  });

  tagged.forEach((entry, i) => {
    if (entry.speed !== null) {
      if (entry.speed > SPEED_MAX) {
        entry.speed = null;
      } else if (i > 0 && i < tagged.length - 1) {
        const prev = tagged[i - 1].speed;
        const next = tagged[i + 1].speed;
        if (prev !== null && next !== null) {
          const avg = (prev + next) / 2;
          if (Math.abs(entry.speed - avg) > SPEED_OUTLIER_THRESHOLD) {
            entry.speed = null;
          }
        }
      }
    }
  });


  const interpolateList = (list, key) => {
    for (let i = 0; i < list.length; i++) {
      if (list[i][key] === null) {
        let prevIdx = i - 1, nextIdx = i + 1;
        while (prevIdx >= 0 && list[prevIdx][key] === null) prevIdx--;
        while (nextIdx < list.length && list[nextIdx][key] === null) nextIdx++;

        const prevVal = prevIdx >= 0 ? list[prevIdx][key] : null;
        const nextVal = nextIdx < list.length ? list[nextIdx][key] : null;

        if (prevVal !== null && nextVal !== null) {
          list[i][key] = (prevVal + nextVal) / 2;
        } else if (prevVal !== null) {
          list[i][key] = prevVal;
        } else if (nextVal !== null) {
          list[i][key] = nextVal;
        }
      }
    }
  };

  interpolateList(tagged, "speed");
  interpolateList(tagged, "battery");
  interpolateList(tagged, "motorTemp");

  return tagged;
}