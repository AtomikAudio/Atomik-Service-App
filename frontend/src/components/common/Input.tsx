import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { DURATION, EASE_OUT } from '../../utils/motion';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
  icon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  editable = true,
  multiline = false,
  numberOfLines = 1,
  style,
  icon,
  rightIcon,
  onRightIconPress,
}) => {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;
  const liftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(borderAnim, {
        toValue: focused ? 1 : 0,
        duration: DURATION.fast,
        easing: EASE_OUT,
        useNativeDriver: false,
      }),
      Animated.spring(liftAnim, {
        toValue: focused ? 1 : 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, borderAnim, liftAnim]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? COLORS.red : 'rgba(255,255,255,0.08)',
      error ? COLORS.red : 'rgba(142,48,47,0.55)',
    ],
  });

  const translateY = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1],
  });

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      {/* borderColor needs JS driver; transform needs native — separate views */}
      <Animated.View
        style={[
          styles.inputWrapper,
          multiline && styles.inputWrapperMultiline,
          error && styles.inputWrapperError,
          !editable && styles.inputWrapperDisabled,
          { borderColor },
        ]}
      >
        <Animated.View
          style={[
            styles.inputInner,
            multiline && styles.inputInnerMultiline,
            { transform: [{ translateY }] },
          ]}
        >
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={focused ? COLORS.white : COLORS.gray}
              style={styles.leftIcon}
            />
          )}
          <TextInput
            style={[
              styles.input,
              icon && styles.inputWithLeftIcon,
              multiline ? styles.multilineInput : styles.singleLineInput,
            ]}
            placeholder={placeholder}
            placeholderTextColor={COLORS.grayDark}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry && !showPassword}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            editable={editable}
            multiline={multiline}
            numberOfLines={numberOfLines}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            selectionColor={COLORS.red}
          />
          {secureTextEntry && (
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.rightIconBtn}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={COLORS.gray}
              />
            </TouchableOpacity>
          )}
          {rightIcon && !secureTextEntry && (
            <TouchableOpacity onPress={onRightIconPress} style={styles.rightIconBtn}>
              <Ionicons name={rightIcon} size={18} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  inputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    maxHeight: 50,
  },
  inputWrapperError: {},
  inputWrapperDisabled: {
    opacity: 0.5,
  },
  inputWrapperMultiline: {
    minHeight: 120,
  },
  inputInnerMultiline: {
    minHeight: 118,
    maxHeight: undefined,
    alignItems: 'flex-start',
  },
  input: {
    color: COLORS.white,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    paddingHorizontal: 16,
  },
  singleLineInput: {
    flex: 1,
    height: 50,
    paddingVertical: 0,
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  multilineInput: {
    flex: 1,
    minHeight: 110,
    paddingVertical: 14,
    textAlignVertical: 'top',
  },
  leftIcon: {
    paddingLeft: 14,
  },
  rightIconBtn: {
    paddingRight: 14,
    paddingLeft: 8,
  },
  errorText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.red,
    marginTop: 6,
  },
});
