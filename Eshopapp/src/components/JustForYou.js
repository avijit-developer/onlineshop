import React from 'react';
import { View, Text, FlatList, Image, StyleSheet, Dimensions } from 'react-native';

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
    price: '$17.00',
    image: require('../assets/product2.png'),
  },
  {
    id: '3',
    title: 'Lorem ipsum dolor sit amet consectetur',
    price: '$17.00',
    image: require('../assets/product3.png'),
  },
  {
    id: '4',
    title: 'Lorem ipsum dolor sit amet consectetur',
    price: '$17.00',
    image: require('../assets/product4.png'),
  },
  {
    id: '5',
    title: 'Lorem ipsum dolor sit amet consectetur',
    price: '$17.00',
    image: require('../assets/product5.png'),
  },
  {
    id: '6',
    title: 'Lorem ipsum dolor sit amet consectetur',
    price: '$17.00',
    image: require('../assets/product6.png'),
  }
  // ...more items
];

const numColumns = 2;
const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 45) / 2; // 16px padding + 4px gap * 2

const JustForYou = () => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Just For You</Text>
        
      </View>
      <FlatList
        data={data}
        numColumns={numColumns}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={styles.row}
        
        renderItem={({ item }) => (
          <View style={[styles.card, { width: cardWidth }]}>
            <Image source={item.image} style={styles.image} />
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.price}>{item.price.replace('$', '₹')}</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    </View>
  );
};

export default JustForYou;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    top: -20
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  star: {
    fontSize: 16,
    color: '#b3111fff',
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    
    marginBottom:10,
    
  },
  image: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardTitle: {
    fontSize: 13,
    padding: 8,
    color: '#333',
  },
  price: {
    fontSize: 15,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingBottom: 12,
    color: '#000',
    color:'#FFA726'
  },
});
