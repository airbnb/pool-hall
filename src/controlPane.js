import express from 'express';

const DEFAULT_SETTINGS = {
  port: 21474,
  defaultPanes: [],
};

function startControlPane(pool, { port = DEFAULT_SETTINGS.port, panes = [] }) {
  const control = express();
  control.listen(port);
  pool.controlPane = control; // eslint-disable-line no-param-reassign
  panes.concat(DEFAULT_SETTINGS.defaultPanes).forEach(pane => pane(pool, control));
  return control;
}

/**
 * Starts an express server that can take
 * @param {poolHall} pool     the pool instance
 * @param {Object} settings
 *        port:     port for the internal server to listen on
 *        panes:    callbacks that takes in (pool, expressApp),
 *                  and attaches express middlewares on the app
 */
export default function controlPane(pool, settings = {}) {
  if (pool.isSupervisor) {
    return startControlPane(pool, settings);
  }
  return null;
}
