import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, PanResponder, TouchableOpacity, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../theme/colors';
import { SignaturePosition } from '../types';

interface DraggableOverlayProps {
  strokes: string[];
  originalWidth: number;
  originalHeight: number;
  initialPosition?: SignaturePosition | null;
  onPositionChange: (pos: SignaturePosition) => void;
  onDelete: () => void;
}

export const DraggableOverlay: React.FC<DraggableOverlayProps> = ({
  strokes,
  originalWidth,
  originalHeight,
  initialPosition,
  onPositionChange,
  onDelete,
}) => {
  // States
  const [position, setPosition] = useState({ x: 50, y: 100 });
  const [size, setSize] = useState({ width: 150, height: 75 });
  const [isLocked, setIsLocked] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Keep track of start states during drag/resize
  const dragStartPos = useRef({ x: 50, y: 100 });
  const resizeStartSize = useRef({ width: 150, height: 75 });

  // Refs for current state to avoid stale closures in PanResponder
  const currentPosRef = useRef(position);
  const currentSizeRef = useRef(size);
  const currentLockRef = useRef(isLocked);

  // Sync refs with state
  useEffect(() => {
    currentPosRef.current = position;
    currentSizeRef.current = size;
    currentLockRef.current = isLocked;
  }, [position, size, isLocked]);

  // Initialize from props if loaded from draft
  useEffect(() => {
    if (initialPosition) {
      setPosition({ x: initialPosition.x, y: initialPosition.y });
      setSize({ width: initialPosition.width, height: initialPosition.height });
      setIsLocked(initialPosition.rotate === 1); // Using rotate as lock flag (1 = locked, 0 = unlocked)
    }
  }, [initialPosition]);

  // Report changes to parent
  const reportChange = (x: number, y: number, w: number, h: number, locked: boolean) => {
    onPositionChange({
      x,
      y,
      width: w,
      height: h,
      scale: w / originalWidth,
      rotate: locked ? 1 : 0, // Abuse rotate slightly as a lock indicator for simple persistence
    });
  };

  // Body Drag PanResponder
  const dragPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !currentLockRef.current,
      onMoveShouldSetPanResponder: () => !currentLockRef.current,
      onPanResponderGrant: () => {
        setIsActive(true);
        dragStartPos.current = { ...currentPosRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        if (currentLockRef.current) return;
        const newX = dragStartPos.current.x + gestureState.dx;
        const newY = dragStartPos.current.y + gestureState.dy;
        // Clamp to screen bounds roughly
        setPosition({
          x: Math.max(0, newX),
          y: Math.max(0, newY),
        });
      },
      onPanResponderRelease: () => {
        reportChange(
          currentPosRef.current.x,
          currentPosRef.current.y,
          currentSizeRef.current.width,
          currentSizeRef.current.height,
          currentLockRef.current
        );
      },
    })
  ).current;

  // Corner Resize PanResponder
  const resizePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !currentLockRef.current,
      onMoveShouldSetPanResponder: () => !currentLockRef.current,
      onPanResponderGrant: () => {
        resizeStartSize.current = { ...currentSizeRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        if (currentLockRef.current) return;
        const newW = resizeStartSize.current.width + gestureState.dx;
        
        // Keep aspect ratio roughly (width:height)
        const aspectRatio = originalWidth / originalHeight;
        const finalW = Math.max(60, newW);
        const finalH = finalW / aspectRatio;

        setSize({
          width: finalW,
          height: finalH,
        });
      },
      onPanResponderRelease: () => {
        reportChange(
          currentPosRef.current.x,
          currentPosRef.current.y,
          currentSizeRef.current.width,
          currentSizeRef.current.height,
          currentLockRef.current
        );
      },
    })
  ).current;

  const toggleLock = () => {
    const nextLocked = !currentLockRef.current;
    setIsLocked(nextLocked);
    reportChange(
      currentPosRef.current.x,
      currentPosRef.current.y,
      currentSizeRef.current.width,
      currentSizeRef.current.height,
      nextLocked
    );
  };

  return (
    <View
      style={[
        styles.overlayContainer,
        {
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
        },
        isActive && styles.activeBorder,
        isLocked && styles.lockedBorder,
      ]}
      {...dragPanResponder.panHandlers}
    >
      {/* Click outside detection to dim outline, implemented simple press to focus */}
      <TouchableOpacity 
        activeOpacity={1}
        style={styles.innerPressable}
        onPress={() => setIsActive(!isActive)}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${originalWidth} ${originalHeight}`}
        >
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
        </Svg>
      </TouchableOpacity>

      {/* Control Overlays: Delete & Lock. Visible only when active and not locked */}
      {isActive && (
        <>
          {/* Delete Button (Top-Right) */}
          {!isLocked && (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.controlText}>×</Text>
            </TouchableOpacity>
          )}

          {/* Lock Button (Bottom-Left) */}
          <TouchableOpacity style={[styles.lockButton, isLocked && styles.btnActiveColor]} onPress={toggleLock}>
            <Text style={styles.lockText}>{isLocked ? '🔒' : '🔓'}</Text>
          </TouchableOpacity>

          {/* Resize Handle (Bottom-Right) */}
          {!isLocked && (
            <View
              style={styles.resizeHandle}
              {...resizePanResponder.panHandlers}
            >
              <Text style={styles.resizeText}>◢</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerPressable: {
    width: '100%',
    height: '100%',
  },
  activeBorder: {
    borderColor: COLORS.accent,
    borderStyle: 'dashed',
  },
  lockedBorder: {
    borderColor: COLORS.primary,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
  },
  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  lockButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  btnActiveColor: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  resizeHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  controlText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  lockText: {
    fontSize: 10,
  },
  resizeText: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
