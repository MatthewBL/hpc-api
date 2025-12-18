const fs = require('fs');
const path = require('path');

// Regex to detect the timestamp line that starts each block, e.g.: "Thu Dec 18 04:09:01 2025"
const TIMESTAMP_RE = /^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4}$/;
const HEADER_RE = /^JOBID\s+USER\s+TRES_ALLOC\s+STATE$/m;

/**
 * Read only the tail of a large file and return the last log block lines.
 * A "block" begins with a timestamp line and includes the subsequent header
 * and job lines until the next timestamp or EOF.
 */
function readLastSnapshotChunks(filePath, tailSizeBytes = 512 * 1024) {
    const stats = fs.statSync(filePath);
    const bytesToRead = Math.min(stats.size, tailSizeBytes);
    const fd = fs.openSync(filePath, 'r');
    try {
        const buffer = Buffer.alloc(bytesToRead);
        fs.readSync(fd, buffer, 0, bytesToRead, stats.size - bytesToRead);
        const tail = buffer.toString('utf8');
        const lines = tail.split(/\r?\n/);

        // Find the index of the last timestamp line in the tail
        let tsIdx = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (TIMESTAMP_RE.test((lines[i] || '').trim())) { tsIdx = i; break; }
        }
        if (tsIdx === -1) return [];

        const chunks = [];
        // Collect all lines after the timestamp until the next timestamp or EOF
        for (let i = tsIdx + 1; i < lines.length; i++) {
            const raw = lines[i] ?? '';
            const t = raw.trim();
            if (!t) continue; // skip blank
            if (TIMESTAMP_RE.test(t)) break; // next snapshot begins
            // Split any concatenated jobs on '$' and gather job chunks
            const parts = raw.split('$').map(p => p.trim()).filter(Boolean);
            for (const part of parts) {
                // Ignore pure header chunks without allocations
                if (HEADER_RE.test(part)) continue;
                chunks.push(part);
            }
        }
        return chunks;
    } finally {
        fs.closeSync(fd);
    }
}

/**
 * Parse GPU usage counts (A30, A40, A100) from job lines in the last block only.
 * @returns {{A30:number, A40:number, A100:number}} usage totals for the last snapshot.
 */
function getGpuUsage() {
    const filePath = path.resolve(__dirname, '../../../../uso_cluster.txt');

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

        // Read last snapshot chunks; if not found in 512KB tail, try 2MB
        let chunks = readLastSnapshotChunks(filePath, 512 * 1024);
        if (!chunks.length) {
            chunks = readLastSnapshotChunks(filePath, 2 * 1024 * 1024);
        }

        const totals = { A30: 0, A40: 0, A100: 0 };

        for (const chunk of chunks) {
            // Find all typed GPU assignments and take the last one on the line
            const matches = Array.from(chunk.matchAll(/gres\/gpu:a(\d+)\s*=\s*(\d+)/g));
            if (!matches.length) continue;
            const [_, typeNumStr, countStr] = matches[matches.length - 1];
            const typeNum = parseInt(typeNumStr, 10);
            const count = parseInt(countStr, 10) || 0;
            const key = typeNum === 30 ? 'A30' : typeNum === 40 ? 'A40' : typeNum === 100 ? 'A100' : null;
            if (key) totals[key] += count;
        }

        return totals;
}

module.exports = { getGpuUsage };