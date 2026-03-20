export type CodexStorePaths = {
  codexHome: string;
  historyPath: string;
  sessionIndexPath: string;
  sessionsDir: string;
  stateDbPath: string;
};

export type ResolveCodexHomeOptions = {
  codexHome?: string;
  homeDir?: string;
  platform?: NodeJS.Platform;
};

export type CodexSchemaReport = {
  missingTables: string[];
  missingThreadColumns: string[];
  supported: boolean;
  tables: string[];
  threadColumns: string[];
};
