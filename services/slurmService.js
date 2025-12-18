const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const jobStore = require('./jobStore');
const execAsync = promisify(exec);

class SlurmService {
  async startJob(gpuType, options = {}) {
    const {
      model = 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
      port = 9000,
      gpus = 4,
      cpus = 8,
      period = '01:00:00',
      node = 'gpu08'
    } = options;

    try {
      // Prefer calling the GPU-specific shell script directly so we can capture the JOB_ID immediately
      const scriptMap = { a30: 'vllm_serve_run_a30.sh', a40: 'vllm_serve_run_a40.sh', a100: 'vllm_serve_run_a100.sh' };
      const scriptName = scriptMap[String(gpuType).toLowerCase()] || scriptMap.a100;
      const scriptPath = path.join(__dirname, '..', scriptName);

      // Execute the script; it prints a line like "JOB_ID=12345" quickly after sbatch
      const cmd = `${scriptPath} ${model} ${port} ${gpus} ${cpus} ${period} ${node}`;
      const { stdout, stderr } = await execAsync(cmd);

      let jobId = null;
      let gpuNode = null;

      // Parse stdout for the job ID from shell script output (format: "JOB_ID=12345")
      const jobIdMatch = String(stdout).match(/JOB_ID=(\d+)/);
      if (jobIdMatch) jobId = jobIdMatch[1];

      // Try to get the node name if we have a job ID
      if (jobId) {
        try {
          const { stdout: squeueOut } = await execAsync(`squeue -j ${jobId} -o "%N" --noheader`);
          gpuNode = squeueOut ? squeueOut.trim() : node;
        } catch (nodeErr) {
          console.warn(`Failed to get node for job ${jobId}:`, nodeErr.message || nodeErr);
          gpuNode = node; // Fallback to requested node
        }

        // Schedule a background check in ~30s to cancel if still pending
        setTimeout(async () => {
          try {
            const { stdout: stateOut } = await execAsync(`squeue -j ${jobId} --noheader -o "%t"`);
            const stateCode = (stateOut || '').trim();
            if (stateCode === 'PD') {
              const cancelRes = await this.cancelJob(jobId);
              if (!cancelRes.success) {
                console.warn(`Auto-cancel failed for job ${jobId}:`, cancelRes.error || cancelRes);
              } else {
                console.log(`Auto-cancelled pending job ${jobId} after 30s.`);
              }
            }
          } catch (bgErr) {
            // If squeue fails, do nothing; subsequent state derivation will clean up
          }
        }, 30000);
      } else {
        // If we still don't have a job ID, log but continue (job was still submitted)
        console.warn('Could not extract job ID from shell script output');
        if (stdout) console.warn('stdout:', stdout);
        if (stderr) console.warn('stderr:', stderr);
        gpuNode = node;
      }

      return { success: true, jobId, gpuNode, message: 'Job started successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getJobStatus() {
    try {
      // Use a pipe delimiter to avoid whitespace splitting issues and include
      // both the time used (%M), time limit (%l) and time left (%L).
      // --noheader avoids the header line so we only parse job lines.
      const format = '%i|%T|%j|%N|%M|%l|%L';
      const { stdout } = await execAsync(`squeue -o "${format}" --noheader`);

      const jobs = stdout.split('\n')
        .map(line => line.trim())
        .filter(line => line && line.includes('temp_'))
        .map(line => {
          const parts = line.split('|').map(p => p.trim());
          // parts: [id, status, name, node, timeUsed, timeLimit, timeLeft]
          const [id, status, name, node, time, period, timeLeft] = parts;
          return { id, status, name, node, time, period, timeLeft };
        });
      
      return { success: true, jobs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async cancelJob(jobId) {
    try {
      // Check if the job is registered in our persistent store. If it's not
      // present, notify the caller that the job was not found instead of
      // returning a generic success (scancel can be a no-op when the job
      // doesn't exist).
      const stored = await jobStore.findJob(String(jobId));
      if (!stored) {
        return { success: false, error: `Job ${jobId} not found`, code: 404 };
      }

      await execAsync(`scancel ${jobId}`);

      // Remove the job from persisted store
      try {
        await jobStore.removeJob(jobId);
      } catch (err) {
        console.warn(`Failed to remove persisted job ${jobId}:`, err.message || err);
      }

      return { success: true, message: 'Job cancelled successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SlurmService();