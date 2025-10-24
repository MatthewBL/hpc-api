const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const llmQueryService = require('./llmQueryService'); // Add this import
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

      // Register the job with the query service
      if (jobId) {
        llmQueryService.registerJob(jobId, {
          port,
          model,
          node: gpuNode,
          gpuType,
          startTime: new Date().toISOString()
        });
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
      
      // Unregister the job from query service
      llmQueryService.unregisterJob(jobId);
      
      return { success: true, message: 'Job cancelled successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SlurmService();