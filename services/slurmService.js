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
      
      // Extract job info from output
      const jobMatch = stdout.match(/New job (\S+) in GPU (\S+)/);
      const jobId = jobMatch ? jobMatch[1] : null;
      const gpuNode = jobMatch ? jobMatch[2] : null;
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