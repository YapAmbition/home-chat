import config from './config.json' with {type:'json'};

export const frontendPort = config.frontendPort;
export const backendPort = process.env.PORT ? Number(process.env.PORT) : config.backendPort;

for (const [name, value] of Object.entries({frontendPort, backendPort})) {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(name + ' 必须是 1 至 65535 的整数');
  }
}
if (frontendPort === backendPort) throw new Error('前端和后端必须使用不同端口');
