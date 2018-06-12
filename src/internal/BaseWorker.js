import EventEmitter from 'events';

export default class BaseWorker extends EventEmitter {
  constructor(options, internalMessageHandler) {
    super();

    this.id = options.id;
    this.state = options.state;

    if (options.process) {
      this.setProcess(options.process, internalMessageHandler);
    }
  }

  setProcess(process, internalMessageHandler) {
    this.process = process;
    this.process.on('error', (code, signal) => this.emit('error', code, signal));
    this.process.on('message', (message, handle) => {
      if (message.poolHallInternal) {
        internalMessageHandler(this, message);
      } else {
        this.emit('message', message, handle);
      }
    });
    this.process.on('disconnect', () => this.emit('disconnect'));
  }

  send(...args) {
    if (this.process.connected) {
      try {
        return this.process.send(...args);
      } catch (e) {
        this.emit('sendError', e, args);
      }
    }

    return false;
  }

  isDead() {
    return this.process.exitCode != null || this.process.signalCode != null;
  }
}
