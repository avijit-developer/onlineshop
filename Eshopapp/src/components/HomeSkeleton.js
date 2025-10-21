import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton from './Skeleton';

const Row = ({ children, style }) => <View style={[styles.row, style]}>{children}</View>;

const HomeSkeleton = () => {
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
        <Row>
          <Skeleton width={'48%'} height={220} borderRadius={12} />
          <Skeleton width={'48%'} height={220} borderRadius={12} style={{ marginLeft: '4%' }} />
        </Row>
        <Row style={{ marginTop: 12 }}>
          <Skeleton width={'48%'} height={220} borderRadius={12} />
          <Skeleton width={'48%'} height={220} borderRadius={12} style={{ marginLeft: '4%' }} />
        </Row>
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
});

export default HomeSkeleton;

