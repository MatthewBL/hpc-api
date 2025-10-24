MODEL ?= deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B
PORT ?= 9000
GPUS ?= 4
CPUS ?= 8
PERIOD ?= 00:30:00
NODE ?= gpu08

RUNNING_GPU = `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`
RUNNING_JOB = `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2`

start_a30:
	@./vllm_serve_run_a30.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE}
	@sleep 1
	@echo "New job `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2` in GPU `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`"
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

start_a40:
	@./vllm_serve_run_a40.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE}
	@sleep 1
	@echo "New job `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2` in GPU `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`"
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

start_a100:
	@./vllm_serve_run_a100.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE}
	@sleep 1
	@echo "New job `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2` in GPU `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`"
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

start_idle_job_a30:
	@./idle_job_a30.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE}
	@sleep 1
	@echo "New job `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2` in GPU `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`"
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

check: 
	@squeue

log: 
	@tail -f slurm-${RUNNING_JOB}.out

query:
	@./sample-query.sh ${MODEL} ${RUNNING_GPU} ${PORT} ${NODE}

start_record_sar:
	@./record_sar.sh

experiment:
	@./matbwyler_experiment.sh ${MODEL} ${RUNNING_GPU} ${PORT} ${NODE}

miniexperiment:
	@./matbwyler_experiment_mini.sh ${MODEL} ${RUNNING_GPU} ${PORT} ${NODE}

quickminiexperiment:
	@./matbwyler_experiment_mini_quick.sh ${MODEL} ${RUNNING_GPU} ${PORT} ${NODE}

donquixoteexperiment:
	@./matbwyler_experiment_donquixote.sh ${MODEL} ${RUNNING_GPU} ${PORT} ${NODE}

lightexperiment:
	@./matbwyler_experiment_light_experiment.sh ${MODEL} ${RUNNING_GPU} ${PORT} ${NODE}

moderateexperiment:
	@./matbwyler_experiment_moderate_experiment.sh ${MODEL} ${RUNNING_GPU} ${PORT} ${NODE}

heavyexperiment:
	@./matbwyler_experiment_heavy_experiment.sh ${MODEL} ${RUNNING_GPU} ${PORT} ${NODE}

rateexperiment:
	@./rate_test.sh ${MODEL} ${RUNNING_GPU} ${PORT} ${NODE}

batchexperiment:
	@./batch_test.sh ${MODEL} ${RUNNING_GPU} ${PORT} ${NODE}

quotaexperiment:
	@./quota_test.sh ${MODEL} ${RUNNING_GPU} ${PORT} ${NODE}

stop:
	@scancel ${RUNNING_JOB}
	@echo "Stoped job ${RUNNING_JOB}"

clean:
	@mv slurm-*.out archive
	@mv temp_*.slurm archive
	

vars:
	@echo "MODEL = <${MODEL}>, PORT = <${PORT}>, GPUS = <${GPUS}>, CPUS = <${CPUS}>, PERIOD = <${PERIOD}> NODE = <${NODE}>"

	
