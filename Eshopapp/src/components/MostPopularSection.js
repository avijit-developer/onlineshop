import React from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AntDesign from 'react-native-vector-icons/AntDesign';


const mostPopular = [
  {
    id: '1',
    image: require('../assets/popular1.png'),
    likes: 1780,
    tag: 'New',
  },
  {
    id: '2',
    image: require('../assets/popular2.png'),
    likes: 1780,
    tag: 'Sale',
  },
  {
    id: '3',
    image: require('../assets/popular3.png'),
    likes: 1780,
    tag: 'Hot',
  },
  {
    id: '4',
    image: require('../assets/popular4.png'),
    likes: 1780,
  },
];

const MostPopularSection = () => {
  const renderItem = ({ item }) => (
    <View style={{ marginBottom: 5 }}>
    <View style={styles.card}>
      <Image source={item.image} style={styles.image} />
      <View style={styles.favicon}>
        <AntDesign name="heart" size={14} color="#FFA726" />
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.likes}>
          <Text style={styles.likesText}>{item.likes}</Text>
        </View>
        {item.tag && <Text style={styles.tag}>{item.tag}</Text>}
      </View>
    </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Most Popular</Text>
        <TouchableOpacity style={styles.seeAll}>
          <Text style={styles.seeAllText}>See All</Text>
          <Ionicons name="arrow-forward-circle" size={18} color="#FFA726" />
        </TouchableOpacity>
      </View>

      {/* Horizontal List */}
      <FlatList
        horizontal
        data={mostPopular}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      />
    </View>
  );
};

export default MostPopularSection;

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: '#FFA726',
    fontWeight: '500',
  },
  card: {
    width: 140,
    borderRadius: 6,
    backgroundColor: '#fff',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  image: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
  },
  likes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesText: {
    fontSize: 13,
    color: '#000',
  },
  tag: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  favicon:{
    position:'absolute',
    top:'10',
    left:'10',
    width:22,
    height:22,
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    backgroundColor: 'rgba(250, 250, 250, .9)',
    borderRadius:20,
    paddingTop:2,
    
    },
});
