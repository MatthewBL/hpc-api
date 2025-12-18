const fs = require('fs');
const path = require('path');

function getLastBlockGPUCountsAlternative(fileContent) {
  const lines = fileContent.trim().split('\n');
  const gpuCounts = {
    'A30': 0,
    'A40': 0,
    'A100': 0
  };
  
  // Find the last occurrence of "JOBID" header
  let lastHeaderIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().startsWith('JOBID')) {
      lastHeaderIndex = i;
      break;
    }
  }
  
  if (lastHeaderIndex === -1) {
    return gpuCounts;
  }
  
  // Process lines after the last header
  for (let i = lastHeaderIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Stop when we reach the next timestamp or empty line
    if (!line || line.startsWith('Thu Dec')) {
      break;
    }
    
    // Split by multiple spaces to get columns
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    
    // Find the TRES_ALLOC part (it contains GPU info)
    const tresAlloc = parts.slice(2, -1).join(' ');
    
    // Extract specific GPU types
    const a30Match = tresAlloc.match(/gres\/gpu:a30=(\d+)/i);
    const a40Match = tresAlloc.match(/gres\/gpu:a40=(\d+)/i);
    const a100Match = tresAlloc.match(/gres\/gpu:a100=(\d+)/i);
    
    if (a30Match) gpuCounts.A30 += parseInt(a30Match[1]);
    if (a40Match) gpuCounts.A40 += parseInt(a40Match[1]);
    if (a100Match) gpuCounts.A100 += parseInt(a100Match[1]);
  }
  
  return gpuCounts;
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
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Use the alternative parsing function
    const totals = getLastBlockGPUCountsAlternative(fileContent);
        
    return totals;
}

module.exports = { getGpuUsage };