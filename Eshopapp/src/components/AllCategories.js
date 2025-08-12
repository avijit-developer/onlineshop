import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity } from 'react-native';

const categories = [
    { id: '1', image: require('../assets/cat1.png') },
    { id: '2', image: require('../assets/cat2.png') },
    { id: '3', image: require('../assets/cat3.png') },
    { id: '4', image: require('../assets/cat4.png') },
    { id: '5', image: require('../assets/cat5.png') },
];

const AllCategories = () => {
            const navigation  = useNavigation();
  
    return (
        <View style={styles.container}>
            <Text style={styles.title}>All Categories</Text>
            <FlatList
        horizontal
        data={categories}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.imageWrapper} onPress={()=>navigation.navigate('ProductList')}>
            <Image source={item.image} style={styles.image} />
          </TouchableOpacity>
        )}
      />
        </View>
    );
};

export default AllCategories;

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  list: {
    gap: 5,
  },
imageWrapper: {
  width: 70,
  height: 70,
  borderRadius: 35,
  backgroundColor: '#fff',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 8,

  // Simulate white ring on white background
  borderWidth: 1,
  borderColor: '#ddd', // light gray border
  elevation: 0, // remove Android shadow
  shadowColor: 'transparent', // remove iOS shadow
},

  image: {
    width: 58,
    height: 58,
    borderRadius: 29,
    resizeMode: 'cover',
  },
});

