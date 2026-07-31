// Owner: S3 | Purpose: React Navigation param-list types

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  Settings: undefined;
  Capture: undefined;
  Question: { sessionId: string };
  Results: { sessionId: string; score: number; total: number };
};

export type AuthStackParamList = {
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
};
