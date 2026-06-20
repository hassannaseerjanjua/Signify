import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet, Text, ViewStyle } from 'react-native';

interface ShimmerProps {
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const Shimmer: React.FC<ShimmerProps> = ({ style, children }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View style={[styles.shimmerBase, style, { opacity: pulseAnim }]}>
      {children}
    </Animated.View>
  );
};

export const FullScreenShimmer: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={styles.splashContainer}>
      <Animated.View
        style={[
          styles.splashLogoWrapper,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Image
          source={require('../assets/logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <Text style={styles.splashTagline}>Sign. Anywhere.</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  shimmerBase: {
    backgroundColor: '#E5E4E0',
    borderRadius: 8,
  },
  // ─── Splash Screen ────────────────────────────
  splashContainer: {
    flex: 1,
    backgroundColor: '#F0EDE8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogoWrapper: {
    alignItems: 'center',
  },
  splashLogo: {
    width: 180,
    height: 110,
  },
  splashTagline: {
    marginTop: 12,
    fontSize: 13,
    color: '#9A9590',
    letterSpacing: 2,
    fontWeight: '500',
  },
});
