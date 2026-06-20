import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { firebaseService } from '../services/firebase';
import { COLORS } from '../theme/colors';
import Svg, { Path } from 'react-native-svg';

interface AuthScreenProps {
  onSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !password) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await firebaseService.login(email, password);
      } else {
        await firebaseService.register(email, password);
      }
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setErrorMsg(null);
    setIsLoading(true);

    try {
      await firebaseService.loginWithGoogle();
      onSuccess();
    } catch (err: any) {
      if (err.message && err.message.includes('developer_error')) {
        setErrorMsg('Google Sign-In configuration error. Please verify SHA-1 fingerprint and Firebase setup.');
      } else if (err.message && !err.message.includes('SIGN_IN_CANCELLED')) {
        setErrorMsg(err.message || 'An error occurred during Google authentication.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isLive = firebaseService.isLive();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <Svg width={180} height={80} viewBox="0 0 100 40">
            {/* Draw a beautiful stylized 'S' signature vector */}
            <Path
              d="M10,25 C20,15 35,5 50,15 C65,25 75,35 90,20"
              fill="none"
              stroke={COLORS.primary}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <Path
              d="M30,30 C45,15 60,10 75,25"
              fill="none"
              stroke={COLORS.accent}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.appName}>Signify</Text>
          <Text style={styles.tagline}>Secure Document Signing</Text>
        </View>

        {/* Form Box */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
          
          {!isLive && (
            <View style={styles.sandboxBadge}>
              <Text style={styles.sandboxBadgeText}>Sandbox Mode (Local storage fallback)</Text>
            </View>
          )}

          {errorMsg && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="name@company.com"
            placeholderTextColor={COLORS.textLight}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder={isLogin ? '••••••••' : 'At least 6 characters'}
            placeholderTextColor={COLORS.textLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />

          <TouchableOpacity 
            style={styles.submitBtn} 
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitBtnText}>
                {isLogin ? 'Sign In' : 'Get Started'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity 
            style={styles.googleBtn} 
            onPress={handleGoogleSubmit}
            disabled={isLoading}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <Path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <Path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <Path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </Svg>
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <TouchableOpacity onPress={() => {
              setIsLogin(!isLogin);
              setErrorMsg(null);
            }}>
              <Text style={styles.toggleBtnText}>
                {isLogin ? ' Register' : ' Log In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.primary,
    fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'sans-serif-medium',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textMedium,
    marginTop: 4,
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 20,
  },
  sandboxBadge: {
    backgroundColor: 'rgba(209, 161, 83, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(209, 161, 83, 0.3)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
  },
  sandboxBadgeText: {
    color: COLORS.accentHover,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    color: COLORS.textDark,
    backgroundColor: COLORS.background,
    fontSize: 15,
  },
  submitBtn: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  dividerText: {
    marginHorizontal: 12,
    color: COLORS.textMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  googleBtn: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.textDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 8,
  },
  googleBtnText: {
    color: COLORS.textDark,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  toggleText: {
    color: COLORS.textMedium,
    fontSize: 14,
  },
  toggleBtnText: {
    color: COLORS.accentHover,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
