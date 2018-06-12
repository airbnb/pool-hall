import assert from 'assert';
import Worker from '../src/internal/Worker';
import { WorkerWorkerProcess as WorkerProcess } from './support';

describe('PoolHall Worker', () => {
  let worker;

  beforeEach(() => {
    worker = new Worker('1', new WorkerProcess());
  });

  describe('ready', () => {
    it('marks the process up and sends a ready message', () => {
      assert.equal(worker.state, 'down');
      worker.ready();
      assert.equal(worker.state, 'up');
      assert.notStrictEqual(worker.process.sentMessages.findIndex(msg => msg[0].act === 'ready'), -1);
    });
  });

  describe('process messages', () => {
    it('sets healthy', (done) => {
      assert.equal(worker.healthy, false);

      worker.on('healthy', () => {
        assert.equal(worker.healthy, true);
        done();
      });

      worker.process.emit('message', { poolHallInternal: true, act: 'healthy' });
    });

    it('sets unhealthy', (done) => {
      worker.healthy = true;

      worker.on('unhealthy', () => {
        assert.equal(worker.healthy, false);
        done();
      });

      worker.process.emit('message', { poolHallInternal: true, act: 'unhealthy' });
    });

    it('handles shutdown', (done) => {
      worker.onShutdown = () => done();

      worker.process.emit('message', { poolHallInternal: true, act: 'shutdown' });
    });
  });
});
