// docs/models.paths.js
// Explicit, ordered OpenAPI paths for the Models API. This file is merged into
// the generated swagger spec so the Models paths appear in the requested order.

module.exports = {
  '/api/models': {
    get: {
      summary: 'List stored models',
      tags: ['Models'],
      responses: {
        '200': {
          description: 'A list of models',
          content: {
            'application/json': {
              example: {
                success: true,
                count: 1,
                models: [
                  {
                    id: 'deepseek_qwen_7B',
                    huggingFaceName: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
                    settings: {
                      port: 9000,
                      gpus: 4,
                      cpus: 8,
                      node: 'gpu08',
                      period: '24:00:00'
                    },
                    running: {
                      port: null,
                      gpus: null,
                      cpus: null,
                      node: null,
                      period: null
                    },
                    state: 'Stopped',
                    _id: 'deepseek_qwen_7B'
                  }
                ]
              }
            }
          }
        }
      }
    },
    post: {
      summary: 'Create a new model record',
      tags: ['Models'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['id', 'huggingFaceName']
            },
            example: {
              id: 'deepseek_qwen_7B',
              huggingFaceName: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B'
            }
          }
        }
      },
      responses: {
        '201': { description: 'Model created' },
        '400': { description: 'Invalid payload' },
        '409': { description: 'Model with id already exists' }
      }
    }
  },

  '/api/models/{id}': {
    get: {
      summary: 'Retrieve a model by id',
      tags: ['Models'],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': {
          description: 'Model details',
          content: {
            'application/json': {
              example: {
                success: true,
                model: {
                  id: 'deepseek_qwen_7B',
                  huggingFaceName: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
                  settings: {
                    port: 9000,
                    gpus: 4,
                    cpus: 4,
                    node: 'gpu02',
                    period: '01:00:00'
                  },
                  running: {
                    port: null,
                    gpus: null,
                    cpus: null,
                    node: null,
                    period: null
                  },
                  state: 'Stopped',
                  _id: 'deepseek_qwen_7B'
                }
              }
            }
          }
        },
        '404': { description: 'Model not found' }
      }
    },
    put: {
      summary: 'Update an existing model (partial update)',
      tags: ['Models'],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object' },
            example: {
              id: 'deepseek_qwen_7B',
              huggingFaceName: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
              settings: {
                port: 9000,
                gpus: 4,
                cpus: 8,
                period: '24:00:00',
                node: 'gpu08'
              }
            }
          }
        }
      },
      responses: { '200': { description: 'Model updated' }, '400': { description: 'Invalid update' }, '404': { description: 'Model not found' } }
    },
    delete: {
      summary: 'Remove a stored model',
      tags: ['Models'],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { '200': { description: 'Model removed' }, '404': { description: 'Model not found' }, '409': { description: 'Model has active job' } }
    }
  },

  '/api/models/{id}/state': {
    get: {
      summary: 'Retrieve only the state of a model',
      tags: ['Models'],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': {
          description: 'Model state',
          content: {
            'application/json': {
              example: {
                success: true,
                state: 'Running',
                running: {
                  port: 9000,
                  gpus: 4,
                  cpus: 4,
                  node: 'gpu04',
                  period: '01:00:00'
                }
              }
            }
          }
        },
        '404': { description: 'Model not found' }
      }
    }
  },

  '/api/models/{id}/run': {
    post: {
      summary: 'Start a Slurm job for the specified model',
      tags: ['Models'],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object' },
            example: {
              port: 9000,
              gpus: 4,
              cpus: 4,
              period: '01:00:00',
              node: 'gpu04'
            }
          }
        }
      },
      responses: { '200': { description: 'Job started' }, '400': { description: 'Bad request' }, '409': { description: 'Model already has a running job' } }
    }
  },

  '/api/models/{id}/stop': {
    post: {
      summary: 'Stop the job running the model',
      tags: ['Models'],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { '200': { description: 'Job stopped' }, '404': { description: 'Job or model not found' } }
    }
  }
};
