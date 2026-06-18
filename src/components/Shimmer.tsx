import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../theme/colors';

interface ShimmerProps {
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const Shimmer: React.FC<ShimmerProps> = ({ style, children }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const startPulse = () => {
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
    };

    startPulse();
  }, [pulseAnim]);

  return (
    <Animated.View style={[styles.shimmerBase, style, { opacity: pulseAnim }]}>
      {children}
    </Animated.View>
  );
};

export const FullScreenShimmer: React.FC = () => {
  return (
    <View style={styles.fullScreenContainer}>
      {/* Header Skeleton */}
      <View style={styles.headerRow}>
        <Shimmer style={styles.avatarSkeleton} />
        <View style={styles.headerTextCol}>
          <Shimmer style={styles.titleSkeleton} />
          <Shimmer style={styles.subtitleSkeleton} />
        </View>
      </View>

      {/* Main Content Card Skeleton */}
      <Shimmer style={styles.heroCardSkeleton} />

      {/* Grid List Skeleton */}
      <View style={styles.listContainer}>
        <Shimmer style={styles.listTitleSkeleton} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.listItemSkeleton}>
            <Shimmer style={styles.iconSkeleton} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Shimmer style={styles.itemTitleSkeleton} />
              <Shimmer style={styles.itemSubtitleSkeleton} />
            </View>
            <Shimmer style={styles.arrowSkeleton} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shimmerBase: {
    backgroundColor: '#E5E4E0', // Matching soft cream/gray for base skeleton
    borderRadius: 8,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  avatarSkeleton: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  headerTextCol: {
    marginLeft: 16,
    flex: 1,
  },
  titleSkeleton: {
    height: 20,
    width: '60%',
    marginBottom: 8,
  },
  subtitleSkeleton: {
    height: 12,
    width: '40%',
  },
  heroCardSkeleton: {
    height: 180,
    width: '100%',
    marginBottom: 32,
    borderRadius: 16,
  },
  listContainer: {
    flex: 1,
  },
  listTitleSkeleton: {
    height: 16,
    width: '35%',
    marginBottom: 16,
  },
  listItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  iconSkeleton: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  itemTitleSkeleton: {
    height: 14,
    width: '70%',
    marginBottom: 8,
  },
  itemSubtitleSkeleton: {
    height: 10,
    width: '40%',
  },
  arrowSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
