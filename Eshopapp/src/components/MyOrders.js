import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MyOrders = () => (
  <View style={styles.container}>
    <Text style={styles.title}>My Orders</Text>
    <Text style={styles.info}>Track, return, or reorder items</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    marginBottom: 10,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  info: {
    marginTop: 4,
    color: 'gray',
  },
});

export default MyOrders;