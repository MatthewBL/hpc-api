const fs = require('fs');
const path = require('path');

function getLastBlockGPUCounts(fileContent) {
  // Split by lines and filter out empty lines
  const lines = fileContent.trim().split('\n').filter(line => line.trim());
  
  // Find the start index of the last timestamp block
  let lastTimestampIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('JOBID') && i > 0) {
      lastTimestampIndex = i - 1;
      break;
    }
  }
  
  // If no timestamp found, start from beginning
  const startIndex = lastTimestampIndex >= 0 ? lastTimestampIndex + 2 : 0;
  
  // Initialize GPU counts
  const gpuCounts = {
    'A30': 0,
    'A40': 0,
    'A100': 0
  };
  
  // Process each job line in the last block (skip header line)
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip header lines and timestamp lines
    if (line.includes('JOBID') || line.includes('Thu Dec')) {
      continue;
    }
    
    // Extract GPU information from TRES_ALLOC column
    const columns = line.split(/\s{2,}/);
    if (columns.length < 4) continue;
    
    const tresAlloc = columns[2];
    
    // Extract GPU type and count using regex
    const gpuRegex = /gres\/gpu:(\w+)=(\d+)/g;
    let match;
    
    while ((match = gpuRegex.exec(tresAlloc)) !== null) {
      const gpuType = match[1].toUpperCase();
      const count = parseInt(match[2], 10);
      
      if (gpuCounts.hasOwnProperty(gpuType)) {
        gpuCounts[gpuType] += count;
      }
    }
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
    const totals = getLastBlockGPUCounts(fileContent);
        
    return totals;
}

module.exports = { getGpuUsage };