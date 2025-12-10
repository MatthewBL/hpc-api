const { spawn, exec } = require('child_process');
const { promisify } = require('util');
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
      // Call sbatch directly to get the job ID from the output
      // instead of querying squeue (which has race condition issues with multiple jobs)
      const sbatchCommand = `make start_${gpuType} MODEL=${model} PORT=${port} GPUS=${gpus} CPUS=${cpus} PERIOD=${period} NODE=${node}`;
      const { stdout, stderr } = await execAsync(sbatchCommand);
      
      let jobId = null;
      let gpuNode = null;
      
      // Parse stdout for the job ID from sbatch output
      // sbatch typically outputs: "Submitted batch job 12345"
      const sbatchMatch = stdout.match(/Submitted batch job (\d+)/);
      if (sbatchMatch) {
        jobId = sbatchMatch[1];
      }
      
      // If we couldn't extract job ID from sbatch output, try stderr as well
      if (!jobId && stderr) {
        const stderrMatch = stderr.match(/Submitted batch job (\d+)/);
        if (stderrMatch) {
          jobId = stderrMatch[1];
        }
      }

      // Try to get the node name if we have a job ID
      if (jobId) {
        try {
          // Query squeue for THIS specific job to get the node
          const { stdout: squeueOut } = await execAsync(`squeue -j ${jobId} -o "%N" --noheader`);
          gpuNode = squeueOut ? squeueOut.trim() : node;
        } catch (nodeErr) {
          console.warn(`Failed to get node for job ${jobId}:`, nodeErr.message || nodeErr);
          gpuNode = node; // Fallback to requested node
        }
      } else {
        // If we still don't have a job ID, this is a problem
        console.warn('Could not extract job ID from sbatch output');
        console.warn('stdout:', stdout);
        console.warn('stderr:', stderr);
        gpuNode = node;
      }
      
      return {
        success: true,
        jobId,
        gpuNode,
        message: 'Job started successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
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