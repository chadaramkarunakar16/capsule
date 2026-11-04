// The browser engine never needs native modules (the sharp fallback is only used on the Node server).
export const createRequire = () => () => { throw new Error("native modules are not available in the browser engine"); };
export default { createRequire };
