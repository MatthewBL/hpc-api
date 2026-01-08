#!/bin/bash
slurmFile=$(mktemp /tmp/temp_XXXXXX.slurm)
if [ ! -w "$slurmFile" ]; then
  echo "Failed to create temp file. Check write permissions." >&2
  exit 1
fi

echo "#!/bin/bash" >> "$slurmFile"
SBATCH_LINE="#SBATCH --cpus-per-gpu=$4 --gpus=a30:$3 -t $5 --output=$PWD/logs/slurm-%j.out --error=$PWD/logs/slurm-%j.err"
if [ -n "$6" ]; then
  SBATCH_LINE="$SBATCH_LINE --nodelist=$6"
fi
echo "$SBATCH_LINE" >> "$slurmFile"
cat vllm_serve.slurm_template >> "$slurmFile"
echo "Temp file: $slurmFile"

# Submit the job and capture sbatch output which includes the job id
mkdir -p logs
TOKEN="${HUGGINGFACE_HUB_TOKEN:-${HF_TOKEN}}"
if [ -z "$TOKEN" ] && [ -f ".env" ]; then
  TOKEN=$(grep -E '^(HUGGINGFACE_HUB_TOKEN|HF_TOKEN)=' .env | tail -1 | cut -d= -f2-)
fi
EXPORT_ARGS=""
if [ -n "$TOKEN" ]; then
  EXPORT_ARGS="--export=ALL,HUGGINGFACE_HUB_TOKEN=$TOKEN"
fi
SUBMIT_OUT=$(sbatch $EXPORT_ARGS "$slurmFile" "$1" "$2") || SUBMIT_OUT=""

# Try to extract the job id from sbatch output ("Submitted batch job 12345")
JOB_ID=$(echo "$SUBMIT_OUT" | awk '{print $4}')

# Register the job with the API using the job id reported by sbatch. This
# avoids racing with squeue parsing from Makefile/other callers.
GPU_NODE=$(squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1 || true)
if [ -n "$JOB_ID" ]; then
  START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  source .env
  curl -sS -X POST http://localhost:$REMOTE_PORT/api/jobs/register \
    -H "Content-Type: application/json" \
    -d '{"jobId": "'"$JOB_ID"'", "port": '"$2"', "model": "'"$1"'", "node": "'"$GPU_NODE"'", "gpuType": "a30", "startTime": "'"$START_TIME"'"}' || true
  # Output the job ID so that the calling process can capture it
  echo "JOB_ID=$JOB_ID"
fi

mkdir -p archive
mv "$slurmFile" archive/
