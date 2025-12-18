const fs = require('fs');
const path = require('path');

// Regex to detect the timestamp line that starts each block, e.g.: "Thu Dec 18 04:09:01 2025"
const TIMESTAMP_RE = /^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4}$/;
const HEADER_RE = /^JOBID\s+USER\s+TRES_ALLOC\s+STATE$/;

/**
 * Read only the tail of a large file and return the last log block lines.
 * A "block" begins with a timestamp line and includes the subsequent header
 * and job lines until the next timestamp or EOF.
 */
function readLastBlockLines(filePath, tailSizeBytes = 512 * 1024) {
    const stats = fs.statSync(filePath);
    const bytesToRead = Math.min(stats.size, tailSizeBytes);
    const fd = fs.openSync(filePath, 'r');
    try {
        const buffer = Buffer.alloc(bytesToRead);
        fs.readSync(fd, buffer, 0, bytesToRead, stats.size - bytesToRead);
        const content = buffer.toString('utf8');
        const lines = content.split(/\r?\n/);

        // Find the index of the last timestamp line in the tail
        let tsIdx = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (TIMESTAMP_RE.test(lines[i].trim())) {
                tsIdx = i;
                break;
            }
        }

        // Fallback: if no timestamp found in tail, try last header line
        if (tsIdx === -1) {
            for (let i = lines.length - 1; i >= 0; i--) {
                if (HEADER_RE.test(lines[i].trim())) {
                    tsIdx = i - 1; // assume timestamp is right above header
                    break;
                }
            }
        }

        if (tsIdx === -1) {
            // Could not locate a block in the tail
            return [];
        }

        // From timestamp, locate header (usually immediate next line)
        let headerIdx = tsIdx + 1;
        if (!HEADER_RE.test((lines[headerIdx] || '').trim())) {
            // Search forward within a small window for header
            const end = Math.min(lines.length, tsIdx + 10);
            headerIdx = -1;
            for (let i = tsIdx + 1; i < end; i++) {
                if (HEADER_RE.test((lines[i] || '').trim())) {
                    headerIdx = i;
                    break;
                }
            }
            if (headerIdx === -1) return [];
        }

        // Block lines: from headerIdx+1 until next timestamp or EOF
        const blockLines = [];
        for (let i = headerIdx + 1; i < lines.length; i++) {
            const line = (lines[i] || '').trim();
            if (!line) continue;
            if (TIMESTAMP_RE.test(line)) break; // next block begins
            blockLines.push(line);
        }
        return blockLines;
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

    const lines = readLastBlockLines(filePath);
    const gpuUsage = { A30: 0, A40: 0, A100: 0 };

    for (const line of lines) {
        // Count type-specific allocations only; ignore generic 'gres/gpu=' without type
        // Use global regex to capture multiple job entries possibly concatenated on one line.
        const reA30 = /gres\/gpu:a30=(\d+)/g;
        const reA40 = /gres\/gpu:a40=(\d+)/g;
        const reA100 = /gres\/gpu:a100=(\d+)/g;

        let m;
        while ((m = reA30.exec(line)) !== null) {
            gpuUsage.A30 += parseInt(m[1], 10);
        }
        while ((m = reA40.exec(line)) !== null) {
            gpuUsage.A40 += parseInt(m[1], 10);
        }
        while ((m = reA100.exec(line)) !== null) {
            gpuUsage.A100 += parseInt(m[1], 10);
        }
    }

    return gpuUsage;
}

module.exports = { getGpuUsage };