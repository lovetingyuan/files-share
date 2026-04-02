declare const InspectorBabelPlugin: (
  babel: unknown,
  options?: {
    cwd?: string;
    excludes?: (string | RegExp)[];
  },
) => { name: string; visitor: Record<string, unknown> };

export default InspectorBabelPlugin;
