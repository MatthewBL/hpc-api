#!/bin/bash
slurmFile=$(mktemp temp_XXXXXX.slurm)
echo "#!/bin/bash" >> $slurmFile
echo "#SBATCH --cpus-per-gpu=$4 --gpus=a100:$3 -t $5 --nodelist=$6" >> $slurmFile
cat vllm_serve.slurm_template >> $slurmFile
echo "Temp file: $slurmFile"
sbatch $slurmFile $1 $2
mv $slurmFile archive


