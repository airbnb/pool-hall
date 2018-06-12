import EventEmitter from 'events';
import process from 'process';

import Worker from './internal/Worker';

const poolHall = new EventEmitter();

poolHall.isWorker = true;
poolHall.isSupervisor = false;
poolHall.worker = new Worker(process.env.POOL_HALL_ID, process);

export default poolHall;
