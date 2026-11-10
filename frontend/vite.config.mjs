import {frontendPort, backendPort} from '../ports.mjs';

const target = 'http://127.0.0.1:' + backendPort;
export default {
  server: {
    host: '0.0.0.0',
    port: frontendPort,
    strictPort: true,
    proxy: {'/api': target, '/media': target}
  }
};
