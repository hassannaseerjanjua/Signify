import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, PanResponder, Text } from 'react-native';
import { COLORS } from '../theme/colors';

interface CustomSliderProps {
  value: number;
  min: number;
  max: number;
  onValueChange: (val: number) => void;
  label?: string;
}

export const CustomSlider: React.FC<CustomSliderProps> = ({
  value,
  min,
  max,
  onValueChange,
  label,
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const startValRef = useRef(value);

  // Keep a ref of the latest value to avoid stale closures if needed
  const valRef = useRef(value);
  useEffect(() => {
    valRef.current = value;
  }, [value]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startValRef.current = valRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        if (trackWidthRef.current > 0) {
          const range = max - min;
          const valChange = (gestureState.dx / trackWidthRef.current) * range;
          const newVal = Math.max(
            min,
            Math.min(max, startValRef.current + valChange),
          );
          onValueChange(newVal);
        }
      },
    }),
  ).current;

  // Calculate percentage for thumb/fill, capped between 0 and 100
  let percent = trackWidth > 0 ? ((value - min) / (max - min)) * 100 : 0;
  percent = Math.max(0, Math.min(100, percent));

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.trackArea} {...panResponder.panHandlers}>
        <View
          style={styles.track}
          onLayout={e => {
            setTrackWidth(e.nativeEvent.layout.width);
            trackWidthRef.current = e.nativeEvent.layout.width;
          }}
        >
          <View style={[styles.fill, { width: `${percent}%` }]} />
          <View style={[styles.thumb, { left: `${percent}%` }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 5,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  label: {
    color: COLORS.textDark,
    fontSize: 14,
    marginBottom: 5,
    fontWeight: '600',
    alignSelf: 'flex-start',
  },
  trackArea: {
    width: '100%',
    height: 30, // Larger hit area
    justifyContent: 'center',
  },
  track: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    position: 'relative',
    width: '100%',
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
    position: 'absolute',
    top: -9, // Center thumb vertically relative to track (24/2 - 6/2 = 9)
    marginLeft: -12, // Center thumb horizontally relative to percent
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});
