import 'react-native-gesture-handler';
import './global.css';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';
import { RootStackParamList, MainTabParamList, AuthStackParamList } from './src/types/Navigation';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { useAuthStore } from './src/store/useAuthStore';
import { autoDiscoverBackend } from './src/store/useSettingsStore';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { QuestionScreen } from './src/screens/QuestionScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { Colors, Fonts } from './src/theme/colors';

const Stack = createStackNavigator<RootStackParamList>();
const Auth = createStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

import { Home, ClipboardList } from 'lucide-react-native';

const TabIcon = ({
  icon: Icon,
  label,
  focused,
}: {
  icon: any;
  label: string;
  focused: boolean;
}) => (
  <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 6, width: 60 }}>
    <View
      style={{
        width: 40,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? Colors.primarySoft : 'transparent',
        marginBottom: 2,
      }}
    >
      <Icon size={20} color={focused ? Colors.primary : Colors.textMuted} />
    </View>
    <Text
      style={{
        fontSize: 9,
        fontFamily: focused ? Fonts.bold : Fonts.medium,
        color: focused ? Colors.primary : Colors.textMuted,
        letterSpacing: 0.1,
      }}
      numberOfLines={1}
    >
      {label}
    </Text>
  </View>
);

function MainTabs() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: tabBarHeight,
          paddingBottom: insets.bottom,
          paddingTop: 4,
          elevation: 0,
          shadowColor: Colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 1,
          shadowRadius: 12,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Home} label="Home" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ClipboardList} label="History" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const hasSeenOnboarding = useAuthStore((state) => state.hasSeenOnboarding);

  return (
    <NavigationContainer>
      {hasSeenOnboarding ? (
        <Stack.Navigator
          initialRouteName="MainTabs"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: Colors.surface },
          }}
        >
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Capture" component={CaptureScreen} />
          <Stack.Screen name="Question" component={QuestionScreen} />
          <Stack.Screen name="Results" component={ResultsScreen} />
        </Stack.Navigator>
      ) : (
        <Auth.Navigator
          initialRouteName="Onboarding"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: Colors.surface },
          }}
        >
          <Auth.Screen name="Onboarding" component={OnboardingScreen} />
          <Auth.Screen name="SignIn" component={SignInScreen} />
          <Auth.Screen name="SignUp" component={SignUpScreen} />
        </Auth.Navigator>
      )}
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  // Try to auto-discover the backend on startup — works for both emulator and physical device
  React.useEffect(() => {
    autoDiscoverBackend();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
