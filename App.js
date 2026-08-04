import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import DocumentosScreen from './screens/DocumentosScreen';
import ConversorScreen from './screens/ConversorScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator>
        <Tab.Screen name="Documentos" component={DocumentosScreen} />
        <Tab.Screen name="Conversor" component={ConversorScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
