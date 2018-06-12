import assert from 'assert';
import Worker from '../src/internal/Worker';
import Supervisor from '../src/internal/Supervisor';
import { workerHeartbeat, supervisorHeartbeat } from '../src/heartbeat';
import { WorkerWorkerProcess as WorkerProcess, fork } from './support';

describe('heartbeat', () => {
  describe('Worker', () => {
    let worker;
    let obj;

    beforeEach(() => {
      jest.useFakeTimers();
      worker = new Worker('1', new WorkerProcess());
      obj = workerHeartbeat(worker, {});
    });

    afterEach(() => {
      if (obj && obj.heartbeatTimeout) {
        clearTimeout(obj.heartbeatTimeout);
      }
    });

    it('sends heartbeat', () => {
      worker.ready();
      jest.runOnlyPendingTimers();
      const heartbeats = worker.process.sentMessages.filter(msg => msg[0].act === 'poolHallHeartbeat');
      assert.equal(heartbeats.length, 2); // once when ready, once in scheduled heartbeat
    });
  });

  describe('Supervisor', () => {
    let supervisor;
    let monitor;

    beforeEach(() => {
      supervisor = new Supervisor(fork);
      supervisor.configure({ workerCount: 2, workerEnv: id => ({ POOL_PORT: `${9000 + (+id)}` }) }, {
        execArgv: [], env: {}, exec: 'foo.js', args: [],
      });

      monitor = supervisorHeartbeat(supervisor, {});
    });

    afterEach(() => {
      if (monitor) {
        monitor.stop();
      }
    });

    describe('worker heartbeat', () => {
      const now = process.hrtime();
      const NS_IN_SEC = 1e9;

      function mockHrtime(past) {
        if (typeof past === 'undefined') {
          return now;
        }
        const pastNano = (past[0] * NS_IN_SEC) + past[1];
        const nowNano = (now[0] * NS_IN_SEC) + now[1];
        const diffNano = nowNano - pastNano;

        const diffHrSec = Math.floor(diffNano / NS_IN_SEC);
        const diffHrNano = diffNano - (diffHrSec * NS_IN_SEC);

        return [diffHrSec, diffHrNano];
      }

      process.hrtime = jest.fn(mockHrtime);

      it('records heartbeat', () => {
        supervisor.start();
        const [strId, worker] = Object.entries(supervisor.workers)[0];
        worker.emit('message', { act: 'poolHallHeartbeat' });
        assert.equal(monitor.timestamps[strId], now);
      });

      it('installs timer for heartbeat monitoring', (done) => {
        supervisor.start();
        supervisor.once('workerAllUp', () => {
          assert.notStrictEqual(monitor.monitorHeartbeatTimeout, null);
          done();
        });
        Object.values(supervisor.workers).forEach((worker) => {
          worker.emit('message', { act: 'poolHallHeartbeat' });
          worker.emit('up');
        });
      });

      it('reports stalled workers', (done) => {
        supervisor.start();
        const strId = Object.keys(supervisor.workers)[0];
        monitor.heartbeatStartedAt = now; // timer won't be installed immediately
        monitor.timestamps[strId] = [now[0] - 10, now[1]];
        monitor.once('workerStall', (workerId) => {
          assert.equal(workerId, strId);
          done();
        });
        monitor.monitorHeartbeat();
      });

      it('does not report workers not stalled', () => {
        supervisor.start();
        monitor.heartbeatStartedAt = now;
        Object.keys(supervisor.workers)
          .forEach((strId) => {
            monitor.timestamps[strId] = now;
          });
        supervisor.once('workerStall', () => {
          assert.fail();
        });
        monitor.monitorHeartbeat();
      });

      it('reports heartbeat delta since second heartbeat', (done) => {
        supervisor.start();
        monitor.heartbeatStartedAt = now;
        monitor.once('info:workerHeartbeatDelta', () => done());
        Object.values(supervisor.workers).forEach((worker) => {
          worker.emit('message', { act: 'poolHallHeartbeat' });
          worker.emit('up');
        });
        Object.values(supervisor.workers).forEach((worker) => {
          worker.emit('message', { act: 'poolHallHeartbeat' });
        });
      });
    });
  });
});
