import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  FlatList,
  Animated,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { Modal, Image } from 'react-native';
import { Spacing, Radius } from '@/constants/colors';
import { useTheme } from '@/hooks/useTheme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const STORAGE_KEY = 'docupro:facturas';
const CLIENTES_KEY = 'docupro:clientes';

const TEXTOS = {
  es: { factura: 'FACTURA', cliente: 'Cliente', concepto: 'Concepto', total: 'Total' },
  en: { factura: 'INVOICE', cliente: 'Client', concepto: 'Concept', total: 'Total' },
  ca: { factura: 'FACTURA', cliente: 'Client', concepto: 'Concepte', total: 'Total' },
};

type ItemFactura = { descripcion: string; cantidad: string; precio: string };
type Factura = { id: string; cliente: string; items: ItemFactura[]; importe: string; fecha: string; pagada?: boolean; numero?: string; notificationId?: string };

export default function DocumentosScreen() {
  const { colors, gradients, isDark, mode, setMode } = useTheme();
  const styles = getStyles(colors);

  const [cliente, setCliente] = useState('');
  const [items, setItems] = useState<ItemFactura[]>([{ descripcion: '', cantidad: '1', precio: '' }]);

  const agregarItem = () => setItems([...items, { descripcion: '', cantidad: '1', precio: '' }]);
  const quitarItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const actualizarItem = (idx: number, campo: keyof ItemFactura, valor: string) => {
    const nuevos = [...items];
    nuevos[idx] = { ...nuevos[idx], [campo]: valor };
    setItems(nuevos);
  };
  const [generando, setGenerando] = useState(false);
  const [historial, setHistorial] = useState<Factura[]>([]);
  const [clientes, setClientes] = useState<string[]>([]);
  const [mostrarListaClientes, setMostrarListaClientes] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [idioma, setIdioma] = useState<'es' | 'en' | 'ca'>('es');
  const [plantilla, setPlantilla] = useState<'minimalista' | 'corporativo' | 'colorido'>('minimalista');
  const [modalPerfil, setModalPerfil] = useState(false);
  const [perfil, setPerfil] = useState({ nombreEmpresa: '', nif: '', direccion: '', logo: '' });

  const cardAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      cardAnim.setValue(0);
      Animated.timing(cardAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
      cargarHistorial();
      cargarPerfil();
      cargarClientes();
      configurarNotificaciones();
    }, [])
  );

  const cargarPerfil = async () => {
    try {
      const raw = await AsyncStorage.getItem('docupro:perfil');
      if (raw) setPerfil(JSON.parse(raw));
    } catch {}
  };

  const guardarPerfil = async (nuevo: typeof perfil) => {
    setPerfil(nuevo);
    await AsyncStorage.setItem('docupro:perfil', JSON.stringify(nuevo));
  };

  const elegirLogo = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Necesitas dar permiso para acceder a tus fotos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0].base64) {
      const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      guardarPerfil({ ...perfil, logo: dataUri });
    }
  };

  const cargarHistorial = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setHistorial(raw ? JSON.parse(raw) : []);
    } catch {
      setHistorial([]);
    }
  };

  const configurarNotificaciones = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('facturas-pendientes', {
        name: 'Facturas pendientes',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: '#4F46E5',
        sound: 'default',
      });
    }
    await Notifications.requestPermissionsAsync();
  };

  const programarRecordatorio = async (factura: Factura): Promise<string | undefined> => {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💸 ¡Factura pendiente de cobro!',
          body: `${factura.numero || ''} · ${factura.cliente} te debe ${factura.importe} € — no te olvides de cobrar`,
          data: { facturaId: factura.id },
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId: 'facturas-pendientes' } : {}),
        },
        trigger: { seconds: 60 * 60 * 24 * 3, channelId: 'facturas-pendientes' } as any,
      });
      return id;
    } catch {
      return undefined;
    }
  };

  const cargarClientes = async () => {
    try {
      const raw = await AsyncStorage.getItem(CLIENTES_KEY);
      setClientes(raw ? JSON.parse(raw) : []);
    } catch {
      setClientes([]);
    }
  };

  const guardarCliente = async (nombre: string) => {
    if (!nombre.trim()) return;
    try {
      const raw = await AsyncStorage.getItem(CLIENTES_KEY);
      const lista: string[] = raw ? JSON.parse(raw) : [];
      if (!lista.includes(nombre.trim())) {
        lista.unshift(nombre.trim());
        await AsyncStorage.setItem(CLIENTES_KEY, JSON.stringify(lista));
        setClientes(lista);
      }
    } catch {}
  };

  const guardarEnHistorial = async (factura: Factura) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const lista: Factura[] = raw ? JSON.parse(raw) : [];
      lista.unshift(factura);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
      setHistorial(lista);
    } catch {}
  };

  const exportarCSV = async () => {
    if (historial.length === 0) {
      Alert.alert('No hay facturas para exportar');
      return;
    }
    const encabezado = 'Cliente,Concepto,Importe,Fecha,Estado\n';
    const filas = historial
      .map((f) => `"${f.cliente}","${(f.items || []).map((it) => it.descripcion).join(' | ')}",${f.importe},"${f.fecha}",${f.pagada ? 'Pagada' : 'Pendiente'}`)
      .join('\n');
    const csv = encabezado + filas;

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'historial-facturas.csv';
      link.click();
    } else {
      const FileSystem = await import('expo-file-system/legacy');
      const uri = FileSystem.cacheDirectory + 'historial-facturas.csv';
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri);
    }
  };

  const togglePagada = async (id: string) => {
    const factura = historial.find((f) => f.id === id);
    if (factura && !factura.pagada && factura.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(factura.notificationId).catch(() => {});
    }
    const lista = historial.map((f) => (f.id === id ? { ...f, pagada: !f.pagada } : f));
    setHistorial(lista);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  };

  const generarFactura = async () => {
    setGenerando(true);
    const numeroFactura = `FAC-${new Date().getFullYear()}-${String(historial.length + 1).padStart(3, '0')}`;
    const subtotal = items.reduce((acc, it) => acc + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0), 0);
    const iva = subtotal * 0.21;
    const totalConIva = subtotal + iva;
    try {
      const fecha = new Date().toLocaleDateString();
      const t = TEXTOS[idioma];

      const colorPlantilla = plantilla === 'corporativo' ? '#0F172A' : plantilla === 'colorido' ? '#EC4899' : '#4F46E5';
      const logoHtml = perfil.logo ? `<img src="${perfil.logo}" style="height:56px;margin-bottom:12px;" />` : '';
      const empresaHtml = perfil.nombreEmpresa
        ? `<p style="margin:0;font-weight:700;color:#0F172A;">${perfil.nombreEmpresa}</p>
           ${perfil.nif ? `<p style="margin:2px 0;color:#64748B;font-size:13px;">${perfil.nif}</p>` : ''}
           ${perfil.direccion ? `<p style="margin:0;color:#64748B;font-size:13px;">${perfil.direccion}</p>` : ''}`
        : '';

      const itemsHtml = items.map((it) => {
        const cant = parseFloat(it.cantidad) || 0;
        const precio = parseFloat(it.precio) || 0;
        const lineaTotal = (cant * precio).toFixed(2);
        return `<tr style="border-top:1px solid #E2E8F0;"><td style="padding:10px 0;">${it.descripcion || '—'}</td><td style="padding:10px 0;text-align:center;color:#64748B;">${cant}</td><td style="padding:10px 0;text-align:right;color:#64748B;">${precio.toFixed(2)} €</td><td style="padding:10px 0;text-align:right;font-weight:600;">${lineaTotal} €</td></tr>`;
      }).join('');

      const html = `
        <html>
          <body style="font-family: -apple-system, Helvetica, sans-serif; padding: 48px; color: #0F172A;">
            ${logoHtml}
            ${empresaHtml}
            <div style="border-bottom: 3px solid ${colorPlantilla}; padding-bottom: 16px; margin: 24px 0 32px;">
              <h1 style="margin: 0; color: ${colorPlantilla};">${t.factura}</h1>
              <p style="color: #64748B; margin: 4px 0 0;">${fecha}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td colspan="4" style="padding:12px 0;color:#64748B;">${t.cliente}: <strong>${cliente || '—'}</strong></td></tr>
              <tr style="border-bottom:2px solid ${colorPlantilla};"><td style="padding:8px 0;color:#64748B;font-size:12px;">${t.concepto}</td><td style="padding:8px 0;text-align:center;color:#64748B;font-size:12px;">CANT.</td><td style="padding:8px 0;text-align:right;color:#64748B;font-size:12px;">PRECIO</td><td style="padding:8px 0;text-align:right;color:#64748B;font-size:12px;">SUBT.</td></tr>
              ${itemsHtml}
              <tr><td colspan="4" style="padding-top:16px;text-align:right;color:#64748B;">Subtotal: ${subtotal.toFixed(2)} € &nbsp;&nbsp; IVA (21%): ${iva.toFixed(2)} €</td></tr>
              <tr style="border-top:2px solid ${colorPlantilla};"><td colspan="3" style="padding:16px 0;font-size:18px;font-weight:700;">${t.total}</td><td style="padding:16px 0;text-align:right;font-size:18px;font-weight:700;color:${colorPlantilla};">${totalConIva.toFixed(2)} €</td></tr>
            </table>
          </body>        </html>
      `;

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
      }

      const nuevaFactura: Factura = { id: Date.now().toString(), cliente, items, importe: totalConIva.toFixed(2), fecha, pagada: false, numero: numeroFactura };
      const notifId = await programarRecordatorio(nuevaFactura);
      await guardarEnHistorial({ ...nuevaFactura, notificationId: notifId });
      await guardarCliente(cliente);
      setCliente('');
      setItems([{ descripcion: '', cantidad: '1', precio: '' }]);
    } finally {
      setGenerando(false);
    }
  };

  const generarWord = async () => {
    if (!camposCompletos) return;
    setGenerando(true);
    try {
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = await import('docx');
      const fecha = new Date().toLocaleDateString();
      const t = TEXTOS[idioma];
      const subtotal = items.reduce((acc, it) => acc + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0), 0);
      const iva = subtotal * 0.21;
      const totalConIva = subtotal + iva;

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              children: [new TextRun({ text: t.factura, bold: true, size: 48, color: '4F46E5' })],
            }),
            new Paragraph({ text: fecha, spacing: { after: 400 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(t.cliente)] }),
                    new TableCell({ children: [new Paragraph(cliente)] }),
                  ],
                }),
                ...items.map((it) => new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(`${it.descripcion} (x${it.cantidad})`)] }),
                    new TableCell({ children: [new Paragraph(`${(((parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0))).toFixed(2)} €`)] }),
                  ],
                })),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t.total, bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${totalConIva.toFixed(2)} €`, bold: true })] })] }),
                  ],
                }),
              ],
            }),
          ],
        }],
      });

      const { Buffer } = await import('buffer');
      const blob = await Packer.toBase64String(doc);

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${blob}`;
        link.download = 'factura.docx';
        link.click();
      } else {
        const FileSystem = await import('expo-file-system/legacy');
        const uri = FileSystem.cacheDirectory + 'factura.docx';
        await FileSystem.writeAsStringAsync(uri, blob, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(uri);
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar el documento Word.');
    } finally {
      setGenerando(false);
    }
  };

  const onPressIn = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  const LIMITE_GRATIS = 3;
  const esPremium = false; // TODO: conectar con RevenueCat.getCustomerInfo()
  const alcanzoLimite = !esPremium && historial.length >= LIMITE_GRATIS;
  const subtotalItems = items.reduce((acc, it) => acc + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0), 0);
  const itemsValidos = items.every((it) => it.descripcion && it.cantidad && it.precio);
  const camposCompletos = cliente && items.length > 0 && itemsValidos && !alcanzoLimite;
  const nextMode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
  const modeIcon = mode === 'system' ? '🔄' : mode === 'light' ? '☀️' : '🌙';

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={gradients.header} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.headerDecoCircle1} />
        <View style={styles.headerDecoCircle2} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.eyebrow}>NUEVO DOCUMENTO</Text>
            <Text style={styles.titulo}>Crear Factura</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={styles.themeBtn} onPress={() => setModalPerfil(true)}>
              <Text style={styles.themeBtnText}>🏢</Text>
            </Pressable>
            <Pressable style={styles.themeBtn} onPress={() => setMode(nextMode)}>
              <Text style={styles.themeBtnText}>{modeIcon}</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabs}>
        <Pressable style={[styles.tabBtn, !mostrarHistorial && styles.tabBtnActive]} onPress={() => setMostrarHistorial(false)}>
          <Text style={[styles.tabBtnText, !mostrarHistorial && styles.tabBtnTextActive]}>Nueva</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, mostrarHistorial && styles.tabBtnActive]} onPress={() => setMostrarHistorial(true)}>
          <Text style={[styles.tabBtnText, mostrarHistorial && styles.tabBtnTextActive]}>Historial ({historial.length})</Text>
        </Pressable>
      </View>

      {mostrarHistorial ? (
        <>
        {historial.length > 0 && (
          <Pressable onPress={exportarCSV} style={{ marginHorizontal: Spacing.lg, marginTop: Spacing.sm, alignSelf: 'flex-end' }}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>⬇ Exportar CSV</Text>
          </Pressable>
        )}
        <FlatList
          data={historial}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>Aún no has generado ninguna factura.</Text>}
          renderItem={({ item }) => (
            <Animated.View
              style={{
                opacity: cardAnim,
                transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              }}>
              <View style={styles.historialCard}>
                <View style={[styles.historialAccent, { backgroundColor: item.pagada ? colors.success : colors.primary }]} />
                <View style={styles.historialInfo}>
                  <Text style={styles.historialCliente}>{item.cliente}</Text>
                  <Text style={styles.historialConcepto}>
                    {item.items?.[0]?.descripcion || ''}{item.items && item.items.length > 1 ? ` +${item.items.length - 1} más` : ''}
                  </Text>
                  <Text style={styles.historialFecha}>{item.fecha}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.historialImporte}>{item.importe} €</Text>
                  <Pressable onPress={() => togglePagada(item.id)} style={[styles.estadoBadge, { backgroundColor: item.pagada ? colors.success + '22' : colors.danger + '22' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: item.pagada ? colors.success : colors.danger }}>
                      {item.pagada ? 'Pagada' : 'Pendiente'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          )}
        />
        </>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Animated.View
            style={{
              opacity: cardAnim,
              transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            }}>
            <View style={styles.card}>
              <Field colors={colors} label="Cliente" value={cliente} onChangeText={setCliente} placeholder="Nombre del cliente" />
              {clientes.length > 0 && (
                <View style={{ marginTop: -8, marginBottom: 12 }}>
                  <Pressable onPress={() => setMostrarListaClientes(!mostrarListaClientes)}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      {mostrarListaClientes ? '▲ Ocultar clientes guardados' : `▼ Elegir de ${clientes.length} cliente(s) guardado(s)`}
                    </Text>
                  </Pressable>
                  {mostrarListaClientes && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {clientes.map((nombre) => (
                        <Pressable
                          key={nombre}
                          onPress={() => { setCliente(nombre); setMostrarListaClientes(false); }}
                          style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.primary + '18', borderWidth: 1, borderColor: colors.primary + '40' }}>
                          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{nombre}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.label}>Conceptos</Text>
              {items.map((it, idx) => (
                <View key={idx} style={{ marginBottom: 10, backgroundColor: colors.background, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
                  <Field colors={colors} label="" value={it.descripcion} onChangeText={(v: string) => actualizarItem(idx, 'descripcion', v)} placeholder="Descripción" />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Field colors={colors} label="" value={it.cantidad} onChangeText={(v: string) => actualizarItem(idx, 'cantidad', v)} placeholder="Cant." keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field colors={colors} label="" value={it.precio} onChangeText={(v: string) => actualizarItem(idx, 'precio', v)} placeholder="Precio" keyboardType="numeric" suffix="€" />
                    </View>
                    {items.length > 1 && (
                      <Pressable onPress={() => quitarItem(idx)} style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
                        <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
              <Pressable onPress={agregarItem} style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>+ Añadir concepto</Text>
              </Pressable>
              <Text style={{ textAlign: 'right', color: colors.text, fontWeight: '700', marginBottom: 12 }}>
                Subtotal: {subtotalItems.toFixed(2)} € · IVA: {(subtotalItems * 0.21).toFixed(2)} € · Total: {(subtotalItems * 1.21).toFixed(2)} €
              </Text>

              <View style={styles.field}>
                <Text style={styles.label}>Idioma del PDF</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['es', 'en', 'ca'] as const).map((lang) => (
                    <Pressable
                      key={lang}
                      onPress={() => setIdioma(lang)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: Radius.md,
                        alignItems: 'center',
                        backgroundColor: idioma === lang ? colors.primary : colors.background,
                        borderWidth: 1,
                        borderColor: idioma === lang ? colors.primary : colors.border,
                      }}>
                      <Text style={{ color: idioma === lang ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
                        {lang === 'es' ? 'Español' : lang === 'en' ? 'English' : 'Català'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Plantilla</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['minimalista', 'corporativo', 'colorido'] as const).map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setPlantilla(p)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: Radius.md,
                        alignItems: 'center',
                        backgroundColor: plantilla === p ? colors.primary : colors.background,
                        borderWidth: 1,
                        borderColor: plantilla === p ? colors.primary : colors.border,
                      }}>
                      <Text style={{ color: plantilla === p ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                        {p === 'minimalista' ? 'Minimal' : p === 'corporativo' ? 'Corporativo' : 'Colorido'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={generarFactura} disabled={!camposCompletos || generando}>
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <LinearGradient
                  colors={!camposCompletos ? [colors.border, colors.border] : gradients.button}
                  style={styles.button}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}>
                  <Text style={styles.buttonText}>{generando ? 'Generando…' : 'Generar PDF'}</Text>
                </LinearGradient>
              </Animated.View>
            </Pressable>

            <Pressable onPress={generarWord} disabled={!camposCompletos || generando} style={{ marginTop: Spacing.sm }}>
              <View style={[styles.button, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary, shadowOpacity: 0 }]}>
                <Text style={[styles.buttonText, { color: colors.primary }]}>📄 Generar Word (.docx)</Text>
              </View>
            </Pressable>
          </Animated.View>
        </ScrollView>
      )}
    <Modal visible={modalPerfil} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Datos de tu empresa</Text>

            <Pressable onPress={elegirLogo} style={{ alignItems: 'center', marginBottom: Spacing.sm }}>
              {perfil.logo ? (
                <Image source={{ uri: perfil.logo }} style={{ width: 64, height: 64, borderRadius: Radius.md, marginBottom: 8 }} />
              ) : (
                <View style={{ width: 64, height: 64, borderRadius: Radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 24 }}>🏢</Text>
                </View>
              )}
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                {perfil.logo ? 'Cambiar logo' : 'Añadir logo'}
              </Text>
            </Pressable>

            <TextInput
              style={styles.modalInput}
              placeholder="Nombre de la empresa"
              placeholderTextColor={colors.textSecondary}
              value={perfil.nombreEmpresa}
              onChangeText={(v) => setPerfil({ ...perfil, nombreEmpresa: v })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="NIF / CIF"
              placeholderTextColor={colors.textSecondary}
              value={perfil.nif}
              onChangeText={(v) => setPerfil({ ...perfil, nif: v })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Dirección"
              placeholderTextColor={colors.textSecondary}
              value={perfil.direccion}
              onChangeText={(v) => setPerfil({ ...perfil, direccion: v })}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnSecondary} onPress={() => setModalPerfil(false)}>
                <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.modalBtnPrimary}
                onPress={() => {
                  guardarPerfil(perfil);
                  setModalPerfil(false);
                }}>
                <Text style={styles.modalBtnPrimaryText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, suffix, colors, ...props }: any) {
  const styles = getStyles(colors);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput style={styles.input} placeholderTextColor={colors.textSecondary} {...props} />
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1 },
    content: { padding: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 100 },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl + 12,
      paddingBottom: Spacing.xl,
      borderBottomLeftRadius: Radius.xl,
      borderBottomRightRadius: Radius.xl,
      overflow: 'hidden',
    },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    themeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeBtnText: { fontSize: 18 },
    headerDecoCircle1: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)', top: -40, right: -30 },
    headerDecoCircle2: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -20, left: -20 },
    eyebrow: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5, marginBottom: 6 },
    titulo: { fontSize: 28, fontWeight: '800', color: '#fff' },
    tabs: {
      flexDirection: 'row',
      marginHorizontal: Spacing.lg,
      marginTop: -Spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.sm },
    tabBtnActive: { backgroundColor: colors.primaryLight },
    tabBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    tabBtnTextActive: { color: colors.primary },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    field: { gap: Spacing.xs },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
    },
    input: { flex: 1, paddingVertical: 14, fontSize: 16, color: colors.text },
    suffix: { color: colors.textSecondary, fontWeight: '600' },
    button: {
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: Spacing.lg,
      shadowColor: colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    listContent: { padding: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.sm, paddingBottom: 100 },
    empty: { textAlign: 'center', color: colors.textSecondary, marginTop: Spacing.xl },
    historialCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.sm,
      overflow: 'hidden',
    },
    historialAccent: { width: 4, height: '100%', borderRadius: 2, marginRight: Spacing.md },
    historialInfo: { flex: 1 },
    historialCliente: { fontSize: 15, fontWeight: '700', color: colors.text },
    historialConcepto: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    historialFecha: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    historialImporte: { fontSize: 16, fontWeight: '700', color: colors.primary },
    estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
    modalCard: { backgroundColor: colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: Spacing.xs },
    modalInput: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
    },
    modalActions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end', marginTop: Spacing.xs },
    modalBtnSecondary: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.md },
    modalBtnSecondaryText: { color: colors.textSecondary, fontWeight: '600' },
    modalBtnPrimary: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: Radius.md },
    modalBtnPrimaryText: { color: '#fff', fontWeight: '700' },
  });
}
