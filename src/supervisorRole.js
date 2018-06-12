import { fork } from 'child_process';

import Supervisor from './internal/Supervisor';

const poolHall = new Supervisor(fork);

poolHall.isWorker = false;
poolHall.isSupervisor = true;

export default poolHall;
