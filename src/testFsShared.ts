export const fsMockImpl = {
  existsSync: () => false,
  readFileSync: (_path: string) => '',
  writeFileSync: (_path: string, _data: string) => {},
  appendFileSync: (_path: string, _data: string) => {},
  mkdirSync: () => {},
  readdirSync: () => [] as Array<{ name: string; isDirectory: () => boolean }>,
  unlinkSync: () => {},
  rmSync: () => {},
  cpSync: (_src: string, _dest: string) => {},
};

export const fsMockState = {
  existsSync: (...args: unknown[]) =>
    (fsMockImpl.existsSync as (...a: unknown[]) => unknown)(...args),
  readFileSync: (...args: unknown[]) =>
    (fsMockImpl.readFileSync as (...a: unknown[]) => unknown)(...args),
  writeFileSync: (...args: unknown[]) =>
    (fsMockImpl.writeFileSync as (...a: unknown[]) => unknown)(...args),
  appendFileSync: (...args: unknown[]) =>
    (fsMockImpl.appendFileSync as (...a: unknown[]) => unknown)(...args),
  mkdirSync: (...args: unknown[]) =>
    (fsMockImpl.mkdirSync as (...a: unknown[]) => unknown)(...args),
  readdirSync: (...args: unknown[]) =>
    (fsMockImpl.readdirSync as (...a: unknown[]) => unknown)(...args),
  unlinkSync: (...args: unknown[]) =>
    (fsMockImpl.unlinkSync as (...a: unknown[]) => unknown)(...args),
  rmSync: (...args: unknown[]) => (fsMockImpl.rmSync as (...a: unknown[]) => unknown)(...args),
  cpSync: (...args: unknown[]) => (fsMockImpl.cpSync as (...a: unknown[]) => unknown)(...args),
};

export const mermaidMockImpl = {
  render: (..._args: unknown[]) => Promise.resolve({ svg: '<svg>mock</svg>' }),
};

export const mermaidMockState = {
  default: {
    initialize: (..._args: unknown[]) => {},
    render: (...args: unknown[]) => mermaidMockImpl.render(...args),
  },
};
