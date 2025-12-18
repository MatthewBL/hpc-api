const fs = require('fs');
const path = require('path');

function getLastBlockGPUCounts(fileContent) {
  // Split by lines
  const lines = fileContent.split('\n');
  
  // Find the last timestamp block by working backwards
  let lastBlockStart = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('JOBID') && i > 0 && lines[i-1].includes('Thu Dec')) {
      lastBlockStart = i; // This is the header line index
      break;
    }
  }
  
  // If we couldn't find a proper block, try a different approach
  if (lastBlockStart === -1) {
    // Find the last occurrence of "JOBID"
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('JOBID')) {
        lastBlockStart = i;
        break;
      }
    }
  }
  
  if (lastBlockStart === -1) {
    return { A30: 0, A40: 0, A100: 0 };
  }
  
  const gpuCounts = { A30: 0, A40: 0, A100: 0 };
  
  // Process lines after the header
  for (let i = lastBlockStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Stop when we hit the next timestamp or empty line
    if (!line || line.includes('Thu Dec')) {
      break;
    }
    
    // Debug: log the line being processed
    console.log(`Processing line: ${line}`);
    
    // Extract GPU counts using more specific regex patterns
    const a30Matches = line.match(/gres\/gpu:a30=(\d+)/gi);
    const a40Matches = line.match(/gres\/gpu:a40=(\d+)/gi);
    const a100Matches = line.match(/gres\/gpu:a100=(\d+)/gi);
    
    if (a30Matches) {
      a30Matches.forEach(match => {
        const count = parseInt(match.split('=')[1], 10);
        gpuCounts.A30 += count;
        console.log(`Found A30: ${count}`);
      });
    }
    
    if (a40Matches) {
      a40Matches.forEach(match => {
        const count = parseInt(match.split('=')[1], 10);
        gpuCounts.A40 += count;
        console.log(`Found A40: ${count}`);
      });
    }
    
    if (a100Matches) {
      a100Matches.forEach(match => {
        const count = parseInt(match.split('=')[1], 10);
        gpuCounts.A100 += count;
        console.log(`Found A100: ${count}`);
      });
    }
  }
  
  console.log('Final counts:', gpuCounts);
  return gpuCounts;
}

// Alternative method that handles the exact format better
function getLastBlockGPUCountsExact(fileContent) {
  // Split and get non-empty lines
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  // Find the last header (JOBID line)
  let lastHeaderIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('JOBID') && lines[i].includes('USER') && lines[i].includes('TRES_ALLOC')) {
      lastHeaderIndex = i;
      break;
    }
  }
  
  if (lastHeaderIndex === -1) {
    // Fallback: look for any JOBID line
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('JOBID')) {
        lastHeaderIndex = i;
        break;
      }
    }
  }
  
  const gpuCounts = { A30: 0, A40: 0, A100: 0 };
  
  // Process the block after the last header
  for (let i = lastHeaderIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Stop if we encounter another timestamp or header
    if (line.includes('Thu Dec') || line.includes('JOBID')) {
      break;
    }
    
    // For debugging: show what we're processing
    console.log(`Line ${i}: "${line}"`);
    
    // Method 1: Use string search for GPU types
    if (line.includes('gres/gpu:a30=')) {
      const match = line.match(/gres\/gpu:a30=(\d+)/i);
      if (match) {
        const count = parseInt(match[1], 10);
        gpuCounts.A30 += count;
        console.log(`  Added ${count} A30`);
      }
    }
    
    if (line.includes('gres/gpu:a40=')) {
      const match = line.match(/gres\/gpu:a40=(\d+)/i);
      if (match) {
        const count = parseInt(match[1], 10);
        gpuCounts.A40 += count;
        console.log(`  Added ${count} A40`);
      }
    }
    
    if (line.includes('gres/gpu:a100=')) {
      const match = line.match(/gres\/gpu:a100=(\d+)/i);
      if (match) {
        const count = parseInt(match[1], 10);
        gpuCounts.A100 += count;
        console.log(`  Added ${count} A100`);
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