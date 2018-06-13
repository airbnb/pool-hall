import EventEmitter from 'events';
import process from 'process';

const DEFAULT_SETTINGS = {
  workerInterval: 500,
  monitorInterval: 1000,
  stallTolerance: 5000,
};

function hrtimeToMilliseconds([seconds, nanoseconds]) {
  return Math.floor((seconds * 1e3) + (nanoseconds / 1e6));
}

class HeartbeatMonitor extends EventEmitter {
  constructor(supervisor, { monitorInterval, stallTolerance }) {
    super();

    this.supervisor = supervisor;
    this.monitorInterval = monitorInterval || DEFAULT_SETTINGS.monitorInterval;
    this.stallTolerance = stallTolerance || DEFAULT_SETTINGS.stallTolerance;

    this.monitorHeartbeatTimeout = null;
    this.heartbeatStartedAt = null;
    this.timestamps = {};

    this.start = this.start.bind(this);
    this.monitorHeartbeat = this.monitorHeartbeat.bind(this);
  }

  recordHeartbeat(workerId) {
    const past = this.timestamps[workerId] || this.heartbeatStartedAt;

    if (past !== null) {
      this.emit(
        'info:workerHeartbeatDelta',
        workerId,
        hrtimeToMilliseconds(process.hrtime(past)),
      );
    }
    this.timestamps[workerId] = process.hrtime();
  }

  start() {
    this.heartbeatStartedAt = process.hrtime();

    this.monitorHeartbeat();
  }

  stop() {
    if (this.monitorHeartbeatTimeout) {
      clearTimeout(this.monitorHeartbeatTimeout);
    }
  }

  monitorHeartbeat() {
    if (this.monitorHeartbeatTimeout) {
      clearTimeout(this.monitorHeartbeatTimeout);
    }

    Object.entries(this.supervisor.workers)
      .filter(([, worker]) => !worker.isDead()).forEach(([workerId]) => {
        const ts = this.timestamps[workerId] || this.heartbeatStartAt;
        const delta = hrtimeToMilliseconds(process.hrtime(ts));

        if (delta > this.stallTolerance) {
          this.emit('workerStall', workerId);
          this.emit('info:workerHeartbeatDelta', workerId, delta);
        }
      });

    this.monitorHeartbeatTimeout = setTimeout(
      this.monitorHeartbeat,
      this.monitorInterval,
    );
    this.monitorHeartbeatTimeout.unref();
  }
}

/**
 * Sets up heartbeating on a worker.  This causes the worker to send a
 * heartbeat message approximately every `workerInterval` ms.
 *
 * @param {Worker} worker
 * @param {Object} settings - configuration of the heartbeat
 *
 *    workerInterval {Integer} - interval in ms at which to send heartbeat.
 *
 * @returns {Object} of { heartbeatTimeout }.  heartbeating can be stopped by
 *  clearing this timeout.
 */
export function workerHeartbeat(worker, { workerInterval }) {
  const obj = { heartbeatTimeout: null };
  const interval = workerInterval || DEFAULT_SETTINGS.workerInterval;

  function heartbeatFn() {
    if (obj.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }
    worker.send({ act: 'poolHallHeartbeat' });
    obj.heartbeatTimeout = setTimeout(heartbeatFn, interval);
    obj.heartbeatTimeout.unref();
  }

  worker.once('ready', heartbeatFn);

  return obj;
}

/**
 * Sets up heartbeat monitoring on the supervisor.  This listens for and
 * records heartbeats from workers and periodically checks which workers it has
 * not received heartbeats from in a while.
 *
 * @param {Supervisor} supervisor
 * @param {Object} settings
 *
 *    monitorInterval {Integer} - interval in ms at which to check timestamps
 *                                of heartbeats
 *    stallTolerance {Integer} - length of time in ms since last heartbeat from
 *                               a worker before it is considered stalled.
 *
 * @returns {HeartbeatMonitor} event emitter that emits events about worker
 *    heartbeats.
 */
export function supervisorHeartbeat(supervisor, settings) {
  const monitor = new HeartbeatMonitor(supervisor, settings);

  supervisor.on('workerMessage', (workerId, msg) => {
    if (msg.act === 'poolHallHeartbeat') {
      monitor.recordHeartbeat(workerId);
    }
  });

  supervisor.on('workerAllUp', monitor.start);

  return monitor;
}

/**
 * Installs heartbeating on a pool hall, accounting for worker or supervisor role.
 *
 * @param {poolHall} pool - the pool instance
 * @param {Object} settings
 *
 *    workerInterval {Integer} - interval in ms at which to send heartbeat.
 *    monitorInterval {Integer} - interval in ms at which to check timestamps
 *                                of heartbeats
 *    stallTolerance {Integer} - length of time in ms since last heartbeat from
 *                               a worker before it is considered stalled.
 *
 * @param {Function} supervisor - optional callback to run when process is
 *                                supervisor, receives the heartbeat monitor as
 *                                its arg. This is a good place to attach event
 *                                handlers.
 * @param {Function} worker - optional callback to run when process is worker.
 *
 * @returns Either the HeartbeatMonitor or heartbeatTimeout obj.
 * Example:
 *
 *    heartbeat(poolHall, { workerInterval: 750 }, (monitor) => {
 *      monitor.on('workerStall', (id) => console.log(`Worker ${id} stalled`));
 *    });
 *
 *    startPoolHall({}, supervisor, worker);
 */
export default function heartbeat(pool, settings, supervisor, worker) {
  if (pool.isSupervisor) {
    const monitor = supervisorHeartbeat(pool, settings);

    if (supervisor) {
      supervisor(monitor);
    }

    return monitor;
  }

  const obj = workerHeartbeat(pool.worker, settings);

  if (worker) {
    worker(obj);
  }

  return obj;
}
