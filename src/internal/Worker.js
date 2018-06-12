import { nextTick, env } from 'process';

import BaseWorker from './BaseWorker';

function internalMessageHandler(worker, message) {
  if (message.act === 'healthy') {
    worker.healthy = true; // eslint-disable-line no-param-reassign
    worker.emit('healthy');
  } else if (message.act === 'unhealthy') {
    worker.healthy = false; // eslint-disable-line no-param-reassign
    worker.emit('unhealthy');
  } else if (message.act === 'shutdown') {
    worker.emit('shutdown');
  }
}

export default class Worker extends BaseWorker {
  constructor(id, process) {
    super({
      id,
      process,
      state: 'down',
    }, internalMessageHandler);

    this.healthy = false;
    this.onShutdown = () => nextTick(() => this.process.exit(0));

    this.once('disconnect', () => this.shutdown());
    this.once('shutdown', () => this.shutdown());

    this.heartbeat = this.heartbeat.bind(this);
    this.heartbeatTimeout = null;
    this.heartbeatInterval = parseInt(env.POOL_HALL_HEARTBEAT_INTERVAL, 10);
  }

  ready() {
    this.state = 'up';
    this.heartbeat();
    this.send({ poolHallInternal: true, act: 'ready' });
  }

  heartbeat() {
    if (this.heartbeatTimeout !== null) {
      clearTimeout(this.heartbeatTimeout);
    }
    this.send({ poolHallInternal: true, act: 'heartbeat' });
    this.heartbeatTimeout = setTimeout(this.heartbeat, this.heartbeatInterval);
    this.heartbeatTimeout.unref();
  }

  shutdown() {
    this.onShutdown();
  }
}
