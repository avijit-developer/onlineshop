import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const Skeleton = ({ width = '100%', height = 16, borderRadius = 8, style }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 300],
  });

  return (
    <View style={[{ width, height, borderRadius, overflow: 'hidden' }, styles.base, style]}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#eee',
  },
  shimmer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
});

export default Skeleton;

