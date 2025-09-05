import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import { useNavigation } from '@react-navigation/native';

const NetworkErrorScreen = ({ onRetry }) => {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <View style={styles.illust}> 
        <Icon name="wifi-outline" size={64} color="#f7ab18" />
        <Icon name="close" size={16} color="#f7ab18" style={{ position: 'absolute', right: 26, top: 22 }} />
      </View>
      <Text style={styles.title}>Connection lost</Text>
      <Text style={styles.subtitle}>Please check your internet and try again.</Text>
      <TouchableOpacity onPress={() => { if (typeof onRetry === 'function') onRetry(); else navigation.goBack(); }} style={styles.retryBtn}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingHorizontal: 32 },
  illust: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#fff8e6', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  title: { marginTop: 16, fontSize: 20, fontWeight: '700', color: '#333' },
  subtitle: { marginTop: 6, fontSize: 13, color: '#666', textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: '#f7ab18', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default NetworkErrorScreen;

