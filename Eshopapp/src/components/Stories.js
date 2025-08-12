import React from 'react';
import { View, Text, Image, FlatList, StyleSheet } from 'react-native';

const Stories = () => {
  const data = Array.from({ length: 5 }, (_, i) => ({ id: i.toString() }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stories</Text>
      <FlatList
        data={data}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={() => (
          <Image
            style={styles.image}
            source={{ uri: 'https://via.placeholder.com/80' }}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    marginLeft: 16,
    marginBottom: 8,
    fontWeight: 'bold',
    fontSize: 16,
  },
  image: {
    width: 80,
    height: 80,
    marginHorizontal: 8,
    borderRadius: 40,
  },
});

export default Stories;