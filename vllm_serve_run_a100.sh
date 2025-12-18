#!/bin/bash
slurmFile=$(mktemp /tmp/temp_XXXXXX.slurm)
if [ ! -w "$slurmFile" ]; then
	echo "Failed to create temp file. Check write permissions." >&2
	exit 1
fi

echo "#!/bin/bash" >> "$slurmFile"
SBATCH_LINE="#SBATCH --cpus-per-gpu=$4 --gpus=a100:$3 -t $5 --output=$PWD/logs/slurm-%j.out --error=$PWD/logs/slurm-%j.err"
if [ -n "$6" ]; then
	SBATCH_LINE="$SBATCH_LINE --nodelist=$6"
fi
echo "$SBATCH_LINE" >> "$slurmFile"
cat vllm_serve.slurm_template >> "$slurmFile"
echo "Temp file: $slurmFile"
mkdir -p logs
SUBMIT_OUT=$(sbatch "$slurmFile" "$1" "$2") || SUBMIT_OUT=""
# extract job id from sbatch output
JOB_ID=$(echo "$SUBMIT_OUT" | awk '{print $4}')
GPU_NODE=$(squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1 || true)
if [ -n "$JOB_ID" ]; then
	START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
	curl -sS -X POST http://localhost:3000/api/jobs/register \
		-H "Content-Type: application/json" \
		-d '{"jobId": "'"$JOB_ID"'", "port": '"$2"', "model": "'"$1"'", "node": "'"$GPU_NODE"'", "gpuType": "a100", "startTime": "'"$START_TIME"'"}' || true
	# Output the job ID so that the calling process can capture it
	echo "JOB_ID=$JOB_ID"
fi

mkdir -p archive
mv "$slurmFile" archive/


