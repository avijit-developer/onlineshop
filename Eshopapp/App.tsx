import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { StatusBar, StyleSheet  } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LocationProvider } from './src/contexts/LocationContext';
import { CartProvider } from './src/contexts/CartContext';
import { UserProvider } from './src/contexts/UserContext';
import { AddressProvider } from './src/contexts/AddressContext';
import { WishlistProvider } from './src/contexts/WishlistContext';

const App = () => {
  return ( 
    <>
    <SafeAreaProvider>
      <UserProvider>
        <CartProvider>
          <AddressProvider>
            <WishlistProvider>
              <LocationProvider>
              <StatusBar
                barStyle="dark-content" // or "light-content"
                backgroundColor="#ffffff" // adjust as needed
                translucent={false} // set to true only if you want content under the status bar
              />
              <SafeAreaView style={styles.safeArea}  edges={['top', 'bottom']}>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
              </SafeAreaView>
                          </LocationProvider>
            </WishlistProvider>
          </AddressProvider>
        </CartProvider>
      </UserProvider>
      </SafeAreaProvider>
    </>

  );
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 0, // 👈 Add more if you want more space below StatusBar
  },
});
export default App;