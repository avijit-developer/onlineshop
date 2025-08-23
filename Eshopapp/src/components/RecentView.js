import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, Text, FlatList, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';

const data = [
  {
    id: '1',
    title: 'Lorem ipsum dolor sit amet consectetur',
    price: '$17.00',
    image: require('../assets/product1.png'),
  },
  {
    id: '2',
    title: 'Lorem ipsum dolor sit amet consectetur',
    price: '$32.00',
    image: require('../assets/product2.png'),
  },
  {
    id: '3',
    title: 'Lorem ipsum dolor sit amet consectetur',
    price: '$21.00',
    image: require('../assets/product3.png'),
  },
];

const cardWidth = Dimensions.get('window').width * 0.38;

const RecentView = () => {
  const navigation  = useNavigation();
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Best Seller</Text>
        {/* <TouchableOpacity>
          <Text style={styles.seeAll}>See All ➔</Text>
        </TouchableOpacity> */}
      </View>
      <View style={{ marginBottom: 5 }}>
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={()=>navigation.navigate('ProductDetails', { productId: item.id })}>
              <Image source={item.image} style={styles.image} />
              <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.price}>{item.price.replace('$', '₹')}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
};

export default RecentView;
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  seeAll: {
    fontSize: 13,
    color: '#FFA726',
  },
  listContent: {
    gap: 8, // Reduced gap
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 6,
    width: cardWidth,
    marginRight: 8,
    marginBottom: 8, // spacing between rows
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    // Android elevation
    elevation: 3,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  image: {
    width: '100%',
    height: 110, // Smaller image
  },
  cardTitle: {
    fontSize: 12,
    paddingHorizontal: 6,
    paddingTop: 6,
    color: '#333',
  },
  price: {
    fontSize: 13,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingBottom: 10,
    color: '#FFA726',
    marginTop:7,
  },
});
