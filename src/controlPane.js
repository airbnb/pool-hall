import express from 'express';

function startControlPane(pool, port) {
  const control = express();
  control.listen(port);
  pool.controlPane = control; // eslint-disable-line no-param-reassign
  return control;
}

export default startControlPane;
