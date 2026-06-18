import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../theme/colors';

interface SignaturePadProps {
  onSave: (paths: string[], width: number, height: number) => void;
  onCancel: () => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  onCancel,
}) => {
  const [strokes, setStrokes] = useState<string[]>([]);
  const [currentStroke, setCurrentStroke] = useState<string>('');
  const activePathRef = useRef<string>('');

  // Track layout dimensions to save scale-invariant paths if needed
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: 300,
    height: 200,
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: evt => {
        const { locationX, locationY } = evt.nativeEvent;
        // Start a new path at touch point
        const newPath = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        activePathRef.current = newPath;
        setCurrentStroke(newPath);
      },

      onPanResponderMove: evt => {
        const { locationX, locationY } = evt.nativeEvent;
        // Append line segments
        const nextSegment = ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        activePathRef.current += nextSegment;
        setCurrentStroke(activePathRef.current);
      },

      onPanResponderRelease: () => {
        const finalStroke = activePathRef.current;
        if (finalStroke) {
          setStrokes(prev => [...prev, finalStroke]);
        }
        activePathRef.current = '';
        setCurrentStroke('');
      },
    }),
  ).current;

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setStrokes([]);
    activePathRef.current = '';
    setCurrentStroke('');
  };

  const handleSave = () => {
    if (strokes.length === 0) {
      Alert.alert('Error', 'Please draw a signature first.');
      return;
    }
    onSave(strokes, canvasDimensions.width, canvasDimensions.height);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign your name inside the box</Text>

      <View
        style={styles.canvasContainer}
        onLayout={evt => {
          const { width, height } = evt.nativeEvent.layout;
          setCanvasDimensions({ width, height });
        }}
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height="100%">
          {/* Previous finished strokes */}
          {strokes.map((stroke, index) => (
            <Path
              key={index}
              d={stroke}
              fill="none"
              stroke={COLORS.primary}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {/* Current active stroke */}
          {currentStroke ? (
            <Path
              d={currentStroke}
              fill="none"
              stroke={COLORS.primary}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
        {strokes.length === 0 && !currentStroke && (
          <View style={styles.placeholderContainer} pointerEvents="none">
            <Text style={styles.placeholderText}>Draw Signature Here</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.btnSecondary} onPress={onCancel}>
          <Text style={styles.btnTextSecondary}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.btnSecondary,
            strokes.length === 0 && styles.disabledBtn,
          ]}
          onPress={handleUndo}
          disabled={strokes.length === 0}
        >
          <Text
            style={[
              styles.btnTextSecondary,
              strokes.length === 0 && styles.disabledText,
            ]}
          >
            Undo
          </Text>
        </TouchableOpacity>

        {/* <TouchableOpacity 
          style={[styles.btnSecondary, strokes.length === 0 && styles.disabledBtn]} 
          onPress={handleClear}
          disabled={strokes.length === 0}
        >
          <Text style={[styles.btnTextSecondary, strokes.length === 0 && styles.disabledText]}>Clear</Text>
        </TouchableOpacity> */}

        <TouchableOpacity style={styles.btnPrimary} onPress={handleSave}>
          <Text style={styles.btnTextPrimary}>Save Signature</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 16,
    width: '100%',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  canvasContainer: {
    height: 180,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    position: 'relative',
    overflow: 'hidden',
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: COLORS.textLight,
    fontSize: 16,
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTextPrimary: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  btnTextSecondary: {
    color: COLORS.textMedium,
    fontWeight: '500',
    fontSize: 14,
  },
  disabledBtn: {
    borderColor: COLORS.borderLight,
    opacity: 0.5,
  },
  disabledText: {
    color: COLORS.textLight,
  },
});
