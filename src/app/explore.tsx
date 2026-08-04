import { useState, useRef, useEffect } from 'react';
import { Platform, View, Text, Pressable, StyleSheet, SafeAreaView, Alert, Animated, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import SignatureScreen from 'react-native-signature-canvas';
import { Spacing, Radius } from '@/constants/colors';
import { useTheme } from '@/hooks/useTheme';

async function uriToBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    const FileSystem = await import('expo-file-system/legacy');
    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  }
}

async function guardarOCompartir(pdfBytes: Uint8Array, nombre: string) {
  const { Buffer } = await import('buffer');
  const base64 = Buffer.from(pdfBytes).toString('base64');
  if (Platform.OS === 'web') {
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${base64}`;
    link.download = nombre;
    link.click();
  } else {
    const FileSystem = await import('expo-file-system/legacy');
    const uri = FileSystem.cacheDirectory + nombre;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(uri);
  }
}

export default function ConversorScreen() {
  const { colors, gradients } = useTheme();
  const styles = getStyles(colors);
  const [cargando, setCargando] = useState<string | null>(null);
  const [modalMarca, setModalMarca] = useState(false);
  const [textoMarca, setTextoMarca] = useState('');
  const [modalFirma, setModalFirma] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  const convertirImagenAPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
    if (result.canceled) return;
    setCargando('imagen');
    try {
      const base64 = await uriToBase64(result.assets[0].uri);
      const html = `<img src="data:image/jpeg;base64,${base64}" style="width:100%;" />`;
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri: pdfUri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(pdfUri);
      }
    } finally {
      setCargando(null);
    }
  };

  const unirPdfs = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true });
    if (result.canceled || result.assets.length < 2) {
      if (!result.canceled) Alert.alert('Selecciona al menos 2 PDFs para unir');
      return;
    }
    setCargando('unir');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const { Buffer } = await import('buffer');
      const pdfUnido = await PDFDocument.create();
      for (const archivo of result.assets) {
        const base64 = await uriToBase64(archivo.uri);
        const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const paginas = await pdfUnido.copyPages(pdf, pdf.getPageIndices());
        paginas.forEach((pagina) => pdfUnido.addPage(pagina));
      }
      const pdfBytes = await pdfUnido.save();
      await guardarOCompartir(pdfBytes, 'documento-unido.pdf');
    } catch (e) {
      Alert.alert('Error', 'No se pudieron unir los PDFs. Verifica que sean archivos válidos.');
    } finally {
      setCargando(null);
    }
  };

  const comprimirPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled) return;
    setCargando('comprimir');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const { Buffer } = await import('buffer');
      const base64 = await uriToBase64(result.assets[0].uri);
      const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pdfBytes = await pdf.save({ useObjectStreams: true });
      await guardarOCompartir(pdfBytes, 'documento-comprimido.pdf');
    } catch (e) {
      Alert.alert('Error', 'No se pudo comprimir el PDF.');
    } finally {
      setCargando(null);
    }
  };

  const [pdfParaMarca, setPdfParaMarca] = useState<any>(null);

  const abrirMarcaAgua = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled) return;
    setPdfParaMarca(result.assets[0]);
    setTextoMarca('');
    setModalMarca(true);
  };

  const aplicarMarcaAgua = async () => {
    if (!textoMarca.trim() || !pdfParaMarca) return;
    setModalMarca(false);
    setCargando('marca');
    try {
      const { PDFDocument, rgb, degrees } = await import('pdf-lib');
      const { Buffer } = await import('buffer');
      const base64 = await uriToBase64(pdfParaMarca.uri);
      const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const paginas = pdf.getPages();

      paginas.forEach((pagina) => {
        const { width, height } = pagina.getSize();
        pagina.drawText(textoMarca, {
          x: width / 2 - (textoMarca.length * 6),
          y: height / 2,
          size: 40,
          color: rgb(0.6, 0.6, 0.6),
          opacity: 0.3,
          rotate: degrees(-45),
        });
      });

      const pdfBytes = await pdf.save();
      await guardarOCompartir(pdfBytes, 'documento-marca-agua.pdf');
    } catch (e) {
      Alert.alert('Error', 'No se pudo aplicar la marca de agua.');
    } finally {
      setCargando(null);
      setPdfParaMarca(null);
    }
  };

  const [pdfParaFirma, setPdfParaFirma] = useState<any>(null);

  const abrirFirma = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled) return;
    setPdfParaFirma(result.assets[0]);
    setModalFirma(true);
  };

  const aplicarFirma = async (firmaBase64: string) => {
    setModalFirma(false);
    if (!pdfParaFirma) return;
    setCargando('firma');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const { Buffer } = await import('buffer');
      const base64 = await uriToBase64(pdfParaFirma.uri);
      const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });

      const firmaData = firmaBase64.replace('data:image/png;base64,', '');
      const firmaBytes = Uint8Array.from(Buffer.from(firmaData, 'base64'));
      const firmaImage = await pdf.embedPng(firmaBytes);

      const paginas = pdf.getPages();
      const ultimaPagina = paginas[paginas.length - 1];
      const { width } = ultimaPagina.getSize();
      const firmaAncho = 150;
      const firmaAlto = (firmaImage.height / firmaImage.width) * firmaAncho;

      ultimaPagina.drawImage(firmaImage, {
        x: width - firmaAncho - 40,
        y: 40,
        width: firmaAncho,
        height: firmaAlto,
      });

      const pdfBytes = await pdf.save();
      await guardarOCompartir(pdfBytes, 'documento-firmado.pdf');
    } catch (e) {
      Alert.alert('Error', 'No se pudo aplicar la firma.');
    } finally {
      setCargando(null);
      setPdfParaFirma(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={gradients.header} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.headerDecoCircle1} />
        <View style={styles.headerDecoCircle2} />
        <Text style={styles.eyebrow}>HERRAMIENTAS</Text>
        <Text style={styles.titulo}>Conversor</Text>
      </LinearGradient>

      <Animated.View
        style={{
          flex: 1,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}>
        <View style={styles.content}>
          <Tool colors={colors} icon="🖼️" title="Imagen → PDF" desc="Convierte fotos en documentos PDF" loading={cargando === 'imagen'} onPress={convertirImagenAPdf} />
          <Tool colors={colors} icon="📎" title="Unir PDFs" desc="Combina varios PDFs en uno solo" loading={cargando === 'unir'} onPress={unirPdfs} />
          <Tool colors={colors} icon="🗜️" title="Comprimir PDF" desc="Reduce el tamaño de tu archivo" loading={cargando === 'comprimir'} onPress={comprimirPdf} />
          <Tool colors={colors} icon="💧" title="Marca de agua" desc="Añade texto superpuesto a tu PDF" loading={cargando === 'marca'} onPress={abrirMarcaAgua} />
          <Tool colors={colors} icon="✍️" title="Firmar PDF" desc="Firma con el dedo y estampa en el documento" loading={cargando === 'firma'} onPress={abrirFirma} />
        </View>
      </Animated.View>

      <Modal visible={modalMarca} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Texto de la marca de agua</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: CONFIDENCIAL"
              placeholderTextColor={colors.textSecondary}
              value={textoMarca}
              onChangeText={setTextoMarca}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnSecondary} onPress={() => setModalMarca(false)}>
                <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalBtnPrimary} onPress={aplicarMarcaAgua}>
                <Text style={styles.modalBtnPrimaryText}>Aplicar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalFirma} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <Text style={[styles.modalTitle, { padding: Spacing.lg }]}>Dibuja tu firma</Text>
          <SignatureScreen
            onOK={aplicarFirma}
            onEmpty={() => Alert.alert('Dibuja una firma antes de continuar')}
            descriptionText=""
            webStyle={`.m-signature-pad--footer {display: flex; justify-content: center; gap: 16px; padding: 20px;} .button {background-color: ${colors.primary}; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold;}`}
          />
          <Pressable style={styles.modalBtnSecondary} onPress={() => setModalFirma(false)}>
            <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Tool({ icon, title, desc, loading, onPress, colors }: any) {
  const styles = getStyles(colors);
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} disabled={loading}>
      <Animated.View style={[styles.tool, { transform: [{ scale }] }]}>
        <View style={styles.toolIcon}>
          <Text style={styles.toolIconText}>{icon}</Text>
        </View>
        <View style={styles.toolInfo}>
          <Text style={styles.toolTitle}>{title}</Text>
          <Text style={styles.toolDesc}>{loading ? 'Procesando…' : desc}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Animated.View>
    </Pressable>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
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
    tool: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    toolIcon: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
    toolIconText: { fontSize: 22 },
    toolInfo: { flex: 1 },
    toolTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    toolDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    chevron: { fontSize: 24, color: colors.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
    modalCard: { backgroundColor: colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    modalInput: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
    },
    modalActions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
    modalBtnSecondary: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.md },
    modalBtnSecondaryText: { color: colors.textSecondary, fontWeight: '600' },
    modalBtnPrimary: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: Radius.md },
    modalBtnPrimaryText: { color: '#fff', fontWeight: '700' },
  });
}
