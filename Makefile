RUNNING_GPU = `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`
RUNNING_JOB = `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2`

start_a30:
	@./vllm_serve_run_a30.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE}
	@sleep 1
	@JOB_ID=`squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2`; GPU_NODE=`squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`; \
	curl -sS -X POST http://localhost:3000/api/jobs/register \
	  -H "Content-Type: application/json" \
	  -d "{\"jobId\": \"$$JOB_ID\", \"port\": $(PORT), \"model\": \"$(MODEL)\", \"node\": \"$$GPU_NODE\", \"gpuType\": \"a30\", \"startTime\": \"`date -u +%Y-%m-%dT%H:%M:%SZ`\" }" || true ; \
	echo "Checking job status for 30 seconds for (Resources) state..."; \
	for i in {1..30}; do \
	  STATE=$$(squeue -j $$JOB_ID --noheader -o "%t %R" 2>/dev/null); \
	  if [[ "$$STATE" == *"(Resources)"* ]]; then \
	    if [ $$i -eq 30 ]; then \
	      echo "ERROR: Job $$JOB_ID stuck in (Resources) state for 30 seconds. Canceling job..."; \
	      scancel $$JOB_ID; \
	      exit 1; \
	    fi; \
	    sleep 1; \
	  else \
	    echo "Job allocated: $$STATE"; \
	    break; \
	  fi; \
	done
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

start_a40:
	@./vllm_serve_run_a40.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE}
	@sleep 1
	@JOB_ID=`squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2`; GPU_NODE=`squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`; \
	curl -sS -X POST http://localhost:3000/api/jobs/register \
	  -H "Content-Type: application/json" \
	  -d "{\"jobId\": \"$$JOB_ID\", \"port\": $(PORT), \"model\": \"$(MODEL)\", \"node\": \"$$GPU_NODE\", \"gpuType\": \"a40\", \"startTime\": \"`date -u +%Y-%m-%dT%H:%M:%SZ`\" }" || true ; \
	echo "Checking job status for 30 seconds for (Resources) state..."; \
	for i in {1..30}; do \
	  STATE=$$(squeue -j $$JOB_ID --noheader -o "%t %R" 2>/dev/null); \
	  if [[ "$$STATE" == *"(Resources)"* ]]; then \
	    if [ $$i -eq 30 ]; then \
	      echo "ERROR: Job $$JOB_ID stuck in (Resources) state for 30 seconds. Canceling job..."; \
	      scancel $$JOB_ID; \
	      exit 1; \
	    fi; \
	    sleep 1; \
	  else \
	    echo "Job allocated: $$STATE"; \
	    break; \
	  fi; \
	done
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

start_a100:
	@./vllm_serve_run_a100.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE}
	@sleep 1
	@JOB_ID=`squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2`; GPU_NODE=`squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`; \
	curl -sS -X POST http://localhost:3000/api/jobs/register \
	  -H "Content-Type: application/json" \
	  -d "{\"jobId\": \"$$JOB_ID\", \"port\": $(PORT), \"model\": \"$(MODEL)\", \"node\": \"$$GPU_NODE\", \"gpuType\": \"a100\", \"startTime\": \"`date -u +%Y-%m-%dT%H:%M:%SZ`\" }" || true ; \
	echo "Checking job status for 30 seconds for (Resources) state..."; \
	for i in {1..30}; do \
	  STATE=$$(squeue -j $$JOB_ID --noheader -o "%t %R" 2>/dev/null); \
	  if [[ "$$STATE" == *"(Resources)"* ]]; then \
	    if [ $$i -eq 30 ]; then \
	      echo "ERROR: Job $$JOB_ID stuck in (Resources) state for 30 seconds. Canceling job..."; \
	      scancel $$JOB_ID; \
	      exit 1; \
	    fi; \
	    sleep 1; \
	  else \
	    echo "Job allocated: $$STATE"; \
	    break; \
	  fi; \
	done
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

check: 
	@squeue

log: 
	@tail -f slurm-${RUNNING_JOB}.out

stop:
	@scancel ${RUNNING_JOB}
	@echo "Stoped job ${RUNNING_JOB}"