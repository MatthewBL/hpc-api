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
      const { stdout } = await execAsync(
        `make start_${gpuType} MODEL=${model} PORT=${port} GPUS=${gpus} CPUS=${cpus} PERIOD=${period} NODE=${node}`
      );
      
      // The Makefile itself registers the job by curling /api/jobs/register, but
      // the stdout from `make` may not contain structured job info. Query squeue
      // directly to find the most recent job with the temp_ name pattern (same
      // logic as used in the Makefile) so we can return jobId and gpuNode.
      let jobId = null;
      let gpuNode = null;
      try {
        // Get the most recent job id for temp_ jobs
        const { stdout: idOut } = await execAsync("squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2 | head -1");
        jobId = idOut ? idOut.trim() : null;

        // Get the node name for the most recent temp_ job
        const { stdout: nodeOut } = await execAsync("squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1");
        gpuNode = nodeOut ? nodeOut.trim() : null;
      } catch (parseErr) {
        // Non-fatal: keep jobId/gpuNode as null if parsing fails
        console.warn('Failed to parse squeue for jobId/gpuNode:', parseErr.message || parseErr);
      }
      // NOTE: Persistence/registration of the job is performed externally
      // by calling the API /api/jobs/register (for example from the Makefile).
      // This service returns the detected job info so the caller may register it.
      
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
      const { stdout } = await execAsync('squeue -o "%i %T %j %N %M"');
      const jobs = stdout.split('\n')
        .slice(1) // Skip header
        .filter(line => line.includes('temp_'))
        .map(line => {
          const [id, status, name, node, time] = line.trim().split(/\s+/);
          return { id, status, name, node, time };
        });
      
      return { success: true, jobs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async cancelJob(jobId) {
    try {
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