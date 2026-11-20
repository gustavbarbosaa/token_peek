export type AccountStatus = {
  connected: boolean;
  name: string | null;
  email: string | null;
  planType: string | null;
};

export type LoginMethod = 'browser' | 'device';

export type LoginPrompt = {
  loginId: string;
  userCode: string | null;
};
