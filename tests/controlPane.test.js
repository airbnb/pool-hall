import controlPane from '../src/controlPane';

class MockPool {
  constructor(role) {
    if (role === 'supervisor') {
      this.isSupervisor = true;
    } else {
      this.isSupervisor = false;
    }
  }
}

const mockExpress = {
  get: jest.fn(),
  listen: jest.fn(),
};

jest.mock('express', () => () => mockExpress);

describe('control pane', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('attaches a control pane for supervisor', () => {
    const pool = new MockPool('supervisor');
    const control = controlPane(pool);

    expect(mockExpress.listen).toBeCalled();
    expect(pool.controlPane).toBe(control);
  });

  it('does not attach a control pane for worker', () => {
    const pool = new MockPool('worker');
    controlPane(pool);
    expect(mockExpress.listen).not.toBeCalled();
  });

  it('attaches a control pane for supervisor with the specified port', () => {
    const pool = new MockPool('supervisor');
    controlPane(pool, { port: 1234 });

    expect(mockExpress.listen).toBeCalledWith(1234);
  });

  it('attaches passed routes on the control pane', () => {
    const pool = new MockPool('supervisor');
    const dummyExpressMiddleware = jest.fn();
    const dummyPane = jest.fn((poolHall, control) => {
      control.get(dummyExpressMiddleware);
    });
    const control = controlPane(pool, { panes: [dummyPane] });

    expect(dummyPane).toBeCalledWith(pool, control);
    expect(mockExpress.get).toBeCalledWith(dummyExpressMiddleware);
  });
});
