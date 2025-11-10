#!/bin/bash
slurmFile=$(mktemp temp_XXXXXX.slurm)
echo "#!/bin/bash" >> $slurmFile
echo "#SBATCH --cpus-per-gpu=$4 --gpus=a100:$3 -t $5 --nodelist=$6" >> $slurmFile
cat vllm_serve.slurm_template >> $slurmFile
echo "Temp file: $slurmFile"
SUBMIT_OUT=$(sbatch $slurmFile $1 $2) || SUBMIT_OUT=""
# extract job id from sbatch output
JOB_ID=$(echo "$SUBMIT_OUT" | awk '{print $4}')
GPU_NODE=$(squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1 || true)
if [ -n "$JOB_ID" ]; then
	curl -sS -X POST http://localhost:3000/api/jobs/register \
		-H "Content-Type: application/json" \
		-d "{\"jobId\": \"$JOB_ID\", \"port\": $2, \"model\": \"$1\", \"node\": \"$GPU_NODE\", \"gpuType\": \"a100\", \"startTime\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" }" || true
fi
mv $slurmFile archive


