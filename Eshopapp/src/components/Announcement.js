import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Announcement = () => (
  <View style={styles.container}>
    <Text style={styles.text}>🚀 Free shipping on orders over ₹50!</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffe5b4',
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  text: {
    textAlign: 'center',
  },
});

export default Announcement;