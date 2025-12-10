#!/bin/bash
slurmFile=$(mktemp /tmp/temp_XXXXXX.slurm)
if [ ! -w "$slurmFile" ]; then
  echo "Failed to create temp file. Check write permissions." >&2
  exit 1
fi

echo "#!/bin/bash" >> "$slurmFile"
echo "#SBATCH --cpus-per-gpu=$4 --gpus=a40:$3 -t $5 --nodelist=$6" >> "$slurmFile"
cat vllm_serve.slurm_template >> "$slurmFile"
echo "Temp file: $slurmFile"

# Submit the job and capture sbatch output which includes the job id
SUBMIT_OUT=$(sbatch "$slurmFile" "$1" "$2") || SUBMIT_OUT=""

# Try to extract the job id from sbatch output ("Submitted batch job 12345")
JOB_ID=$(echo "$SUBMIT_OUT" | awk '{print $4}')

# Register the job with the API using the job id reported by sbatch. This
# avoids racing with squeue parsing from Makefile/other callers.
GPU_NODE=$(squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1 || true)
if [ -n "$JOB_ID" ]; then
  START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  curl -sS -X POST http://localhost:3000/api/jobs/register \
    -H "Content-Type: application/json" \
    -d '{"jobId": "'"$JOB_ID"'", "port": '"$2"', "model": "'"$1"'", "node": "'"$GPU_NODE"'", "gpuType": "a40", "startTime": "'"$START_TIME"'"}' || true
fi

mkdir -p archive
mv "$slurmFile" archive/
