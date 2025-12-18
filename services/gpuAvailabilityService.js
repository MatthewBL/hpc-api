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
function readLastBlockText(filePath, tailSizeBytes = 512 * 1024) {
    const stats = fs.statSync(filePath);
    const bytesToRead = Math.min(stats.size, tailSizeBytes);
    const fd = fs.openSync(filePath, 'r');
    try {
        const buffer = Buffer.alloc(bytesToRead);
        fs.readSync(fd, buffer, 0, bytesToRead, stats.size - bytesToRead);
        const tail = buffer.toString('utf8');

        // Find the position of the last timestamp in the tail
        const re = new RegExp(TIMESTAMP_RE.source, 'gm');
        let m, lastPos = -1;
        while ((m = re.exec(tail)) !== null) {
            lastPos = m.index;
        }
        if (lastPos === -1) {
            // Try to find header as a fallback and assume timestamp precedes it on original file
            const hdr = new RegExp(HEADER_RE.source, 'm');
            const hm = hdr.exec(tail);
            if (!hm) return '';
            // Take a conservative slice starting slightly before header occurrence
            lastPos = Math.max(0, hm.index - 64);
        }

        // Find the next timestamp after lastPos to delimit the block
        const after = tail.slice(lastPos + 1);
        const next = new RegExp(TIMESTAMP_RE.source, 'm').exec(after);
        const endPos = next ? (lastPos + 1 + next.index) : tail.length;
        return tail.slice(lastPos, endPos);
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

        // Read last block text; if not found in 512KB tail, try 2MB
        let blockText = readLastBlockText(filePath, 512 * 1024);
        if (!blockText || blockText.length === 0) {
            blockText = readLastBlockText(filePath, 2 * 1024 * 1024);
        }

        const sumMatches = (re) => {
            let total = 0;
            const it = blockText.matchAll(re);
            for (const m of it) {
                total += parseInt(m[1], 10) || 0;
            }
            return total;
        };

        // Count type-specific allocations across entire block text (jobs may be concatenated on one line)
        return {
            A30: sumMatches(/gres\/gpu:a30=(\d+)/g),
            A40: sumMatches(/gres\/gpu:a40=(\d+)/g),
            A100: sumMatches(/gres\/gpu:a100=(\d+)/g),
        };
}

module.exports = { getGpuUsage };