const fs = require('fs');
const path = require('path');

/**
 * Reads the uso_cluster.txt file and parses GPU usage information.
 * @returns {Object} An object containing the count of GPUs in use for each type.
 */
function getGpuUsage() {
    const filePath = path.resolve(__dirname, '../../../../uso_cluster.txt');

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');

    const gpuUsage = {
        A30: 0,
        A40: 0,
        A100: 0
    };

    lines.forEach(line => {
        if (line.includes('gres/gpu:a30')) {
            const match = line.match(/gres\/gpu:a30=(\d+)/);
            if (match) gpuUsage.A30 += parseInt(match[1], 10);
        } else if (line.includes('gres/gpu:a40')) {
            const match = line.match(/gres\/gpu:a40=(\d+)/);
            if (match) gpuUsage.A40 += parseInt(match[1], 10);
        } else if (line.includes('gres/gpu:a100')) {
            const match = line.match(/gres\/gpu:a100=(\d+)/);
            if (match) gpuUsage.A100 += parseInt(match[1], 10);
        }
    });

    return gpuUsage;
}

module.exports = {
    getGpuUsage
};