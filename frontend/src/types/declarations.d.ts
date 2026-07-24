declare module 'react-native-sqlite-storage' {
  export interface SQLiteDatabase {
    executeSql(statement: string, params?: any[]): Promise<[any]>;
    transaction(callback: (tx: any) => Promise<void> | void): Promise<void>;
  }
  export function openDatabase(params: { name: string; location: string }): Promise<SQLiteDatabase>;
  export function enablePromise(enable: boolean): void;
}
