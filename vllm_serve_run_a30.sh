#!/bin/bash
slurmFile=$(mktemp /tmp/temp_XXXXXX.slurm)
if [ ! -w "$slurmFile" ]; then
  echo "Failed to create temp file. Check write permissions." >&2
  exit 1
fi

echo "#!/bin/bash" >> "$slurmFile"
echo "#SBATCH --cpus-per-gpu=$4 --gpus=a30:$3 -t $5 --nodelist=$6" >> "$slurmFile"
cat vllm_serve.slurm_template >> "$slurmFile"
echo "Temp file: $slurmFile"

sbatch "$slurmFile" "$1" "$2"

mkdir -p archive
mv "$slurmFile" archive/
