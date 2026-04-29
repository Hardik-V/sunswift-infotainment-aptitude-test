/**
 * I went with a strict "all-or-nothing" validation for the batch uploads, if one entry is 
 * junk, we reject the whole batch to avoid partial/corrupted data states in the engine logs.
 * Storage is kept in a simple in-memory array for ease of implementation For the summary, 
 * I used a single-pass reduction to calculate min/max/avg simultaneously to keep it snappy 
 * even if the batch sizes grow.
 */

const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

// In-memory "database"
let telemetryLogs = [];

const VALID_COMPONENTS = ['battery', 'motor', 'gps'];


/**
 * POST /logs/upload
 */
app.post('/logs/upload', (req, res) => {
    const batch = req.body;

    // is it even an array?
    if (!Array.isArray(batch)) {
        return res.status(400).json({ error: "Invalid format. Expected a JSON array of logs." });
    }

    // Validate every entry in the batch
    for (let i = 0; i < batch.length; i++) {
        const entry = batch[i];
        const { timestamp, component, value } = entry;

        // Check for missing fields
        if (timestamp === undefined || component === undefined || value === undefined) {
            return res.status(400).json({ 
                error: `Entry at index ${i} is missing required fields.`,
                received: entry 
            });
        }

        // Type validation
        if (typeof timestamp !== 'number' || typeof value !== 'number') {
            return res.status(400).json({ error: `Incorrect types at index ${i}. Timestamp and Value must be numbers.` });
        }

        // Whitelist check
        if (!VALID_COMPONENTS.includes(component)) {
            return res.status(400).json({ error: `Invalid component '${component}' at index ${i}.` });
        }
    }

    // If we got here, commit to memory.
    telemetryLogs.push(...batch);
    
    console.log(`uccessfully stored ${batch.length} new log entries.`);
    res.status(201).json({ message: `Successfully uploaded ${batch.length} entries.` });
});

/**
 * GET /logs/summary
 */
app.get('/logs/summary', (req, res) => {
    if (telemetryLogs.length === 0) {
        return res.json({ 
            count: 0, 
            message: "No logs available." 
        });
    }

    // Find the latest event by timestamp (HACK: using reduce to avoid a full sort)
    const latest = telemetryLogs.reduce((prev, current) => 
        (prev.timestamp > current.timestamp) ? prev : current
    );

    // Group and aggregate by component
    const summary = telemetryLogs.reduce((acc, log) => {
        const comp = log.component;
        
        if (!acc[comp]) {
            acc[comp] = { min: log.value, max: log.value, sum: log.value, count: 1 };
        } else {
            acc[comp].min = Math.min(acc[comp].min, log.value);
            acc[comp].max = Math.max(acc[comp].max, log.value);
            acc[comp].sum += log.value;
            acc[comp].count += 1;
        }
        return acc;
    }, {});

    // Format the averages and clean up the object
    const finalComponents = {};
    Object.keys(summary).forEach(key => {
        const s = summary[key];
        finalComponents[key] = {
            min: Number(s.min.toFixed(4)),
            max: Number(s.max.toFixed(4)),
            avg: Number((s.sum / s.count).toFixed(4)),
            count: s.count
        };
    });

    res.json({
        count: telemetryLogs.length,
        components: finalComponents,
        latest: latest
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});