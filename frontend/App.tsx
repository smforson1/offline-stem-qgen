import './global.css';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center">
      <View className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 max-w-sm mx-4">
        <Text className="text-2xl font-bold text-white text-center mb-2">
          NativeWind + Expo! 🚀
        </Text>
        <Text className="text-slate-400 text-center mb-4">
          Tailwind CSS classes are now fully configured in this Expo project.
        </Text>
        <Text className="text-xs text-slate-500 text-center">
          Edit App.tsx or files inside src/ to start building.
        </Text>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}
