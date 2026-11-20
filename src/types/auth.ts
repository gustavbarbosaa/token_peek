export type AccountStatus = {
  connected: boolean;
  email: string | null;
  planType: string | null;
};

export type LoginPrompt = {
  loginId: string;
  verificationUrl: string;
  userCode: string;
};
