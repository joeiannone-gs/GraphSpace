/** Server-side settings, read from the environment with local-development defaults. */
export const env = {
  databasePath: process.env.DATABASE_PATH || 'data/graphspace.db',
  inviteCode: process.env.INVITE_CODE || '',
};
