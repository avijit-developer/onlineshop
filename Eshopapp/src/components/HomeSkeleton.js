import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import Skeleton from './Skeleton';

const Row = ({ children, style }) => <View style={[styles.row, style]}>{children}</View>;

const HomeSkeleton = () => {
  const data = Array.from({ length: 6 }).map((_, i) => ({ id: String(i) }));
  const renderCard = () => (
    <View style={styles.card}>
      <Skeleton width={'100%'} height={160} borderRadius={12} />
      <Skeleton width={'80%'} height={16} style={{ marginTop: 10, borderRadius: 6 }} />
      <Skeleton width={'60%'} height={14} style={{ marginTop: 8, borderRadius: 6 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <Row>
        <Skeleton width={40} height={40} borderRadius={20} />
        <Skeleton width={'60%'} height={20} style={{ marginLeft: 12, borderRadius: 6 }} />
      </Row>

      {/* Slider (skeleton with bullets) */}
      <Skeleton width={'100%'} height={160} borderRadius={12} style={{ marginTop: 12 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
        <Skeleton width={8} height={8} borderRadius={4} style={{ marginHorizontal: 3 }} />
        <Skeleton width={8} height={8} borderRadius={4} style={{ marginHorizontal: 3 }} />
        <Skeleton width={8} height={8} borderRadius={4} style={{ marginHorizontal: 3 }} />
        <Skeleton width={8} height={8} borderRadius={4} style={{ marginHorizontal: 3 }} />
      </View>

      {/* Categories chips */}
      <Row style={{ marginTop: 16 }}>
        <Skeleton width={80} height={28} borderRadius={14} />
        <Skeleton width={80} height={28} borderRadius={14} style={{ marginLeft: 10 }} />
        <Skeleton width={80} height={28} borderRadius={14} style={{ marginLeft: 10 }} />
        <Skeleton width={80} height={28} borderRadius={14} style={{ marginLeft: 10 }} />
      </Row>

      {/* Grid sections (cards) */}
      <View style={{ marginTop: 16 }}>
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderCard}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  card: {
    width: '48%',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
});

export default HomeSkeleton;

