import EventEmitter from 'events';

export class WorkerWorkerProcess extends EventEmitter {
  constructor() {
    super();
    this.connected = true;
    this.sentMessages = [];
  }

  send(...args) {
    this.sentMessages.push([...args]);
  }
}

let processIds = 0;

export class SupervisorWorkerProcess extends EventEmitter {
  constructor(forkArgs) {
    super();
    this.connected = true;

    processIds += 1;

    this.processId = processIds;
    this.forkArgs = forkArgs;
    this.exitCode = null;
    this.signalCode = null;
    this.sentMessages = [];
  }

  send(...args) {
    this.sentMessages.push([...args]);
  }
}

export function fork(program, args, options) {
  return new SupervisorWorkerProcess({ program, args, options });
}
