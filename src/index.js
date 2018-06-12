import process from 'process';

/**
 * POOL_HALL_ID is set for worker processes.  This is analogous to
 * NODE_UNIQUE_ID in cluster
 */
const supervisorOrWorker = 'POOL_HALL_ID' in process.env ? 'workerRole' : 'supervisorRole';

/**
 * poolHall is based on whether the process is a worker or a supervisor.
 *
 * In a worker process, isWorker is true, and poolHall.worker is the Worker
 * object.
 *
 * In the supervisor process, poolHall is the Supervisor object, which
 * exposes many events pertaining to the state of the pool.  isSupervisor is
 * true.
 */

// eslint-disable-next-line global-require, import/no-dynamic-require
export const poolHall = require(`./${supervisorOrWorker}`).default;

/**
 * Entry point for the Pool Hall.  Unlike node cluster, we can't add custom
 * code to bootstrap_node.js to cause worker processes to behave distinctly.
 *
 * In the supervisor, poolHall.stop() can be called to stop the pool.
 *
 * @param {Object} settings - configuration of the pool
 *
 *    workerCount {Integer} (required) - number of workers in the pool
 *    workerEnv {Function} (required) - function of the worker id that returns
 *                                      env variables to configure the worker
 *                                      process. For instance, port configuration.
 *    minWorkerCount {Integer} - minimum number of worker processes that must be up
 *                               for the pool to be considered healthy.  By default
 *                               workerCount - 2.  This setting comes into play after
 *                               initial pool boot, which requires all processes to
 *                               come up before marking healthy.
 *    args {Array} - args for fork, default process.argv.slice(2)
 *    exec {String} - exec for fork, default process.argv[1]
 *    execArgv {Array} - execArgv for fork, default process.execArgv
 *    env {Object} - env for fork, default process.env
 * @param {Function} supervisor - code to run in the supervisor
 * @param {Function} worker(ready) - code to run in the worker.  Call ready() or
 *                                   poolHall.worker.ready() to signal that
 *                                   the worker is up and ready.
 */
export function startPoolHall(settings, supervisor, worker) {
  if (poolHall.isSupervisor) {
    poolHall.configure(settings, {
      args: process.argv.slice(2),
      exec: process.argv[1],
      execArgv: process.execArgv,
      env: process.env,
    });

    poolHall.start();
    supervisor();
  } else {
    worker(poolHall.worker.ready.bind(poolHall.worker));
  }
}
