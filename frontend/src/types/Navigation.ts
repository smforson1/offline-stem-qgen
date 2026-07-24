// Owner: S3 | Purpose: React Navigation param-list types

export type RootStackParamList = {
  MainTabs: undefined;
  Settings: undefined;
  Capture: undefined;
  Question: { sessionId: string };
  Results: { sessionId: string; score: number; total: number };
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
};
