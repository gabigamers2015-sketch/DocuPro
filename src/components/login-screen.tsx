import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from '@react-native-firebase/auth';
import { Spacing, Radius } from '@/constants/colors';
import { useTheme } from '@/hooks/useTheme';

function traducirError(codigo: string): string {
  switch (codigo) {
    case 'auth/invalid-email':
      return 'El correo no es válido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Correo o contraseña incorrectos.';
    case 'auth/email-already-in-use':
      return 'Ese correo ya tiene una cuenta.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'Sin conexión a internet.';
    default:
      return 'Ocurrió un error, intentá de nuevo.';
  }
}

export default function LoginScreen() {
  const { colors, gradients } = useTheme();
  const styles = getStyles(colors);
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const recuperarPassword = async () => {
    if (!email.trim()) {
      setError('Escribí tu correo arriba para poder enviarte el link.');
      return;
    }
    setError('');
    setMensaje('');
    setCargando(true);
    try {
      await sendPasswordResetEmail(getAuth(), email.trim());
      setMensaje('Te enviamos un correo con el link para restablecer tu contraseña.');
    } catch (e: any) {
      setError(traducirError(e?.code || ''));
    } finally {
      setCargando(false);
    }
  };

  const enviar = async () => {
    if (!email.trim() || !password) {
      setError('Completá correo y contraseña.');
      return;
    }
    setError('');
    setMensaje('');
    setCargando(true);
    try {
      const authInstance = getAuth();
      if (modo === 'login') {
        await signInWithEmailAndPassword(authInstance, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(authInstance, email.trim(), password);
      }
    } catch (e: any) {
      setError(traducirError(e?.code || ''));
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <LinearGradient colors={gradients.header as any} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.headerDecoCircle1} />
          <View style={styles.headerDecoCircle2} />
          <Text style={styles.eyebrow}>DOCUPRO</Text>
          <Text style={styles.titulo}>{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</Text>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.field}>
            <Text style={styles.label}>Correo</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@correo.com"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
            />
          </View>

          {modo === 'login' && (
            <Pressable onPress={recuperarPassword} style={{ alignSelf: 'flex-end' }} disabled={cargando}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          )}

          {mensaje ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.successText}>{mensaje}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable style={[styles.btnPrimary, cargando && { opacity: 0.7 }]} onPress={enviar} disabled={cargando}>
            {cargando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>{modo === 'login' ? 'Entrar' : 'Registrarme'}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => { setModo(modo === 'login' ? 'registro' : 'login'); setError(''); }} style={{ marginTop: Spacing.md, alignItems: 'center' }}>
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
              {modo === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl + 12,
      paddingBottom: Spacing.xl,
      borderBottomLeftRadius: Radius.xl,
      borderBottomRightRadius: Radius.xl,
      overflow: 'hidden',
    },
    headerDecoCircle1: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)', top: -40, right: -30 },
    headerDecoCircle2: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -20, left: -20 },
    eyebrow: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5, marginBottom: 6 },
    titulo: { fontSize: 28, fontWeight: '800', color: '#fff' },
    content: { padding: Spacing.lg, gap: Spacing.md },
    field: { gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.danger + '15', padding: 10, borderRadius: Radius.md },
    errorText: { color: colors.danger, fontSize: 13, flex: 1 },
    successBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.success + '15', padding: 10, borderRadius: Radius.md },
    successText: { color: colors.success, fontSize: 13, flex: 1 },
    btnPrimary: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: Radius.md,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
}
