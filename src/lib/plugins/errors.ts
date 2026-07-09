export class IncompatiblePluginError extends Error {
  constructor(
    public readonly pluginName: string,
    public readonly requiredRange: string,
    public readonly actualVersion: string,
  ) {
    super(
      `Plugin "${pluginName}" requires autonnel ${requiredRange}, but ${actualVersion} is installed`,
    );
    this.name = 'IncompatiblePluginError';
  }
}

export class InvalidBuilderExtensionError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid builder extension(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'InvalidBuilderExtensionError';
  }
}
