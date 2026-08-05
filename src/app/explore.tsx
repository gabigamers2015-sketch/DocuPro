import { useState, useRef, useEffect } from 'react';
import { Platform, View, Text, Pressable, StyleSheet, SafeAreaView, Animated, Modal, TextInput, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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

type ToastTipo = 'success' | 'error';

export default function ConversorScreen() {
  const { colors, gradients } = useTheme();
  const styles = getStyles(colors);
  const [cargando, setCargando] = useState<string | null>(null);
  const [modalMarca, setModalMarca] = useState(false);
  const [textoMarca, setTextoMarca] = useState('');
  const [modalFirma, setModalFirma] = useState(false);
  const [modalImagenPdf, setModalImagenPdf] = useState(false);
  const [imagenesPdf, setImagenesPdf] = useState<{ uri: string }[]>([]);
  const [tamanoPagina, setTamanoPagina] = useState<'A4' | 'Carta'>('A4');
  const [orientacionPdf, setOrientacionPdf] = useState<'vertical' | 'horizontal'>('vertical');
  const [modalUnirPdfs, setModalUnirPdfs] = useState(false);
  const [pdfsAUnir, setPdfsAUnir] = useState<{ uri: string; name: string; size?: number }[]>([]);
  const [toast, setToast] = useState<{ tipo: ToastTipo; mensaje: string } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  const mostrarToast = (tipo: ToastTipo, mensaje: string) => {
    setToast({ tipo, mensaje });
    toastAnim.setValue(0);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
    }, 2600);
  };

  const convertirImagenAPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', multiple: true });
    if (result.canceled || result.assets.length === 0) return;
    setImagenesPdf(result.assets.map((a) => ({ uri: a.uri })));
    setTamanoPagina('A4');
    setOrientacionPdf('vertical');
    setModalImagenPdf(true);
  };

  const agregarMasImagenes = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', multiple: true });
    if (result.canceled || result.assets.length === 0) return;
    setImagenesPdf((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri }))]);
  };

  const quitarImagenPdf = (idx: number) => {
    setImagenesPdf((prev) => prev.filter((_, i) => i !== idx));
  };

  const moverImagenPdf = (idx: number, direccion: -1 | 1) => {
    setImagenesPdf((prev) => {
      const nuevo = [...prev];
      const destino = idx + direccion;
      if (destino < 0 || destino >= nuevo.length) return prev;
      [nuevo[idx], nuevo[destino]] = [nuevo[destino], nuevo[idx]];
      return nuevo;
    });
  };

  const generarPdfDesdeImagenes = async () => {
    if (imagenesPdf.length === 0) return;
    setCargando('imagen');
    try {
      const dims = tamanoPagina === 'A4'
        ? (orientacionPdf === 'vertical' ? '210mm 297mm' : '297mm 210mm')
        : (orientacionPdf === 'vertical' ? '216mm 279mm' : '279mm 216mm');
      const paginasHtml = await Promise.all(
        imagenesPdf.map(async (img) => {
          const base64 = await uriToBase64(img.uri);
          return `<div style="page-break-after: always; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"><img src="data:image/jpeg;base64,${base64}" style="max-width: 100%; max-height: 100%; object-fit: contain;" /></div>`;
        })
      );
      const html = `<html><head><style>@page { size: ${dims}; margin: 10mm; }</style></head><body style="margin:0;">${paginasHtml.join('')}</body></html>`;
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri: pdfUri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(pdfUri);
      }
      mostrarToast('success', `¡PDF creado con ${imagenesPdf.length} página(s)!`);
      setModalImagenPdf(false);
      setImagenesPdf([]);
    } catch (e) {
      mostrarToast('error', 'No se pudo convertir las imágenes.');
    } finally {
      setCargando(null);
    }
  };

  const unirPdfs = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true });
    if (result.canceled || result.assets.length < 2) {
      if (!result.canceled) mostrarToast('error', 'Selecciona al menos 2 PDFs para unir');
      return;
    }
    setPdfsAUnir(result.assets.map((a) => ({ uri: a.uri, name: a.name, size: a.size })));
    setModalUnirPdfs(true);
  };

  const agregarMasPdfs = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true });
    if (result.canceled || result.assets.length === 0) return;
    setPdfsAUnir((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri, name: a.name, size: a.size }))]);
  };

  const quitarPdfAUnir = (idx: number) => {
    setPdfsAUnir((prev) => prev.filter((_, i) => i !== idx));
  };

  const moverPdfAUnir = (idx: number, direccion: -1 | 1) => {
    setPdfsAUnir((prev) => {
      const nuevo = [...prev];
      const destino = idx + direccion;
      if (destino < 0 || destino >= nuevo.length) return prev;
      [nuevo[idx], nuevo[destino]] = [nuevo[destino], nuevo[idx]];
      return nuevo;
    });
  };

  const confirmarUnirPdfs = async () => {
    if (pdfsAUnir.length < 2) return;
    setCargando('unir');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const { Buffer } = await import('buffer');
      const pdfUnido = await PDFDocument.create();
      for (const archivo of pdfsAUnir) {
        const base64 = await uriToBase64(archivo.uri);
        const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const paginas = await pdfUnido.copyPages(pdf, pdf.getPageIndices());
        paginas.forEach((pagina) => pdfUnido.addPage(pagina));
      }
      const pdfBytes = await pdfUnido.save();
      await guardarOCompartir(pdfBytes, 'documento-unido.pdf');
      mostrarToast('success', `¡${pdfsAUnir.length} PDFs unidos!`);
      setModalUnirPdfs(false);
      setPdfsAUnir([]);
    } catch (e) {
      mostrarToast('error', 'No se pudieron unir los PDFs. Verifica que sean archivos válidos.');
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
      mostrarToast('success', '¡PDF comprimido!');
    } catch (e) {
      mostrarToast('error', 'No se pudo comprimir el PDF.');
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
      mostrarToast('success', '¡Marca de agua aplicada!');
    } catch (e) {
      mostrarToast('error', 'No se pudo aplicar la marca de agua.');
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
      mostrarToast('success', '¡Documento firmado!');
    } catch (e) {
      mostrarToast('error', 'No se pudo aplicar la firma.');
    } finally {
      setCargando(null);
      setPdfParaFirma(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={gradients.header as any} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
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
          <Text style={styles.sectionTitle}>CREAR</Text>
          <Tool colors={colors} icon="image-outline" accent="#6366F1" title="Imagen → PDF" desc="Convierte fotos en documentos PDF" loading={cargando === 'imagen'} onPress={convertirImagenAPdf} />

          <Text style={[styles.sectionTitle, { marginTop: Spacing.sm }]}>EDITAR Y PROTEGER</Text>
          <Tool colors={colors} icon="layers-outline" accent="#0EA5E9" title="Unir PDFs" desc="Combina varios PDFs en uno solo" loading={cargando === 'unir'} onPress={unirPdfs} />
          <Tool colors={colors} icon="contract-outline" accent="#10B981" title="Comprimir PDF" desc="Reduce el tamaño de tu archivo" loading={cargando === 'comprimir'} onPress={comprimirPdf} />
          <Tool colors={colors} icon="water-outline" accent="#F59E0B" title="Marca de agua" desc="Añade texto superpuesto a tu PDF" loading={cargando === 'marca'} onPress={abrirMarcaAgua} />
          <Tool colors={colors} icon="create-outline" accent="#EC4899" title="Firmar PDF" desc="Firma con el dedo y estampa en el documento" loading={cargando === 'firma'} onPress={abrirFirma} />
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

      <Modal visible={modalImagenPdf} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg }}>
            <Text style={styles.modalTitle}>Imagen → PDF</Text>
            <Pressable onPress={() => { setModalImagenPdf(false); setImagenesPdf([]); }}>
              <Ionicons name="close" size={26} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1, paddingHorizontal: Spacing.lg }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
              {imagenesPdf.length} imagen(es) — cada una será una página, en este orden
            </Text>

            {imagenesPdf.map((img, idx) => (
              <View key={img.uri + idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, backgroundColor: colors.surface, borderRadius: Radius.md, padding: 8, borderWidth: 1, borderColor: colors.border }}>
                <Image source={{ uri: img.uri }} style={{ width: 56, height: 56, borderRadius: Radius.sm }} resizeMode="cover" />
                <Text style={{ flex: 1, color: colors.text, fontSize: 13 }}>Página {idx + 1}</Text>
                <Pressable onPress={() => moverImagenPdf(idx, -1)} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }}>
                  <Ionicons name="chevron-up" size={20} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => moverImagenPdf(idx, 1)} disabled={idx === imagenesPdf.length - 1} style={{ opacity: idx === imagenesPdf.length - 1 ? 0.3 : 1 }}>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => quitarImagenPdf(idx)}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))}

            <Pressable onPress={agregarMasImagenes} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginBottom: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: Radius.md }}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>Agregar más imágenes</Text>
            </Pressable>

            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, marginBottom: 8 }}>Tamaño de página</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {(['A4', 'Carta'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTamanoPagina(t)}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center', backgroundColor: tamanoPagina === t ? colors.primary : colors.surface, borderWidth: 1, borderColor: tamanoPagina === t ? colors.primary : colors.border }}>
                  <Text style={{ color: tamanoPagina === t ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, marginBottom: 8 }}>Orientación</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              {([{ v: 'vertical', label: 'Vertical', icon: 'phone-portrait-outline' }, { v: 'horizontal', label: 'Horizontal', icon: 'phone-landscape-outline' }] as const).map((o) => (
                <Pressable
                  key={o.v}
                  onPress={() => setOrientacionPdf(o.v)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: orientacionPdf === o.v ? colors.primary : colors.surface, borderWidth: 1, borderColor: orientacionPdf === o.v ? colors.primary : colors.border }}>
                  <Ionicons name={o.icon} size={16} color={orientacionPdf === o.v ? '#fff' : colors.textSecondary} />
                  <Text style={{ color: orientacionPdf === o.v ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={{ padding: Spacing.lg }}>
            <Pressable
              style={[styles.modalBtnPrimary, (imagenesPdf.length === 0 || cargando === 'imagen') && { opacity: 0.6 }]}
              onPress={generarPdfDesdeImagenes}
              disabled={imagenesPdf.length === 0 || cargando === 'imagen'}>
              <Text style={styles.modalBtnPrimaryText}>
                {cargando === 'imagen' ? 'Generando...' : `Crear PDF (${imagenesPdf.length} página${imagenesPdf.length === 1 ? '' : 's'})`}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={modalUnirPdfs} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg }}>
            <Text style={styles.modalTitle}>Unir PDFs</Text>
            <Pressable onPress={() => { setModalUnirPdfs(false); setPdfsAUnir([]); }}>
              <Ionicons name="close" size={26} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1, paddingHorizontal: Spacing.lg }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
              {pdfsAUnir.length} archivo(s) — se unirán en este orden
            </Text>

            {pdfsAUnir.map((pdf, idx) => (
              <View key={pdf.uri + idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, backgroundColor: colors.surface, borderRadius: Radius.md, padding: 10, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{pdf.name}</Text>
                  {pdf.size ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{(pdf.size / 1024).toFixed(0)} KB</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => moverPdfAUnir(idx, -1)} disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }}>
                  <Ionicons name="chevron-up" size={20} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => moverPdfAUnir(idx, 1)} disabled={idx === pdfsAUnir.length - 1} style={{ opacity: idx === pdfsAUnir.length - 1 ? 0.3 : 1 }}>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => quitarPdfAUnir(idx)}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))}

            <Pressable onPress={agregarMasPdfs} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginBottom: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: Radius.md }}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>Agregar más PDFs</Text>
            </Pressable>
          </ScrollView>

          <View style={{ padding: Spacing.lg }}>
            <Pressable
              style={[styles.modalBtnPrimary, (pdfsAUnir.length < 2 || cargando === 'unir') && { opacity: 0.6 }]}
              onPress={confirmarUnirPdfs}
              disabled={pdfsAUnir.length < 2 || cargando === 'unir'}>
              <Text style={styles.modalBtnPrimaryText}>
                {cargando === 'unir' ? 'Uniendo...' : `Unir ${pdfsAUnir.length} PDFs`}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={modalFirma} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <Text style={[styles.modalTitle, { padding: Spacing.lg }]}>Dibuja tu firma</Text>
          <SignatureScreen
            onOK={aplicarFirma}
            onEmpty={() => mostrarToast('error', 'Dibuja una firma antes de continuar')}
            descriptionText=""
            webStyle={`.m-signature-pad--footer {display: flex; justify-content: center; gap: 16px; padding: 20px;} .button {background-color: ${colors.primary}; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold;}`}
          />
          <Pressable style={styles.modalBtnSecondary} onPress={() => setModalFirma(false)}>
            <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>

      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              backgroundColor: toast.tipo === 'success' ? colors.success : colors.danger,
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            },
          ]}>
          <Ionicons name={toast.tipo === 'success' ? 'checkmark-circle' : 'alert-circle'} size={20} color="#fff" />
          <Text style={styles.toastText}>{toast.mensaje}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

function Tool({ icon, accent, title, desc, loading, onPress, colors }: any) {
  const styles = getStyles(colors);
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} disabled={loading}>
      <Animated.View style={[styles.tool, { transform: [{ scale }] }]}>
        <View style={[styles.toolIcon, { backgroundColor: (accent || colors.primary) + '22' }]}>
          {loading ? (
            <Ionicons name="hourglass-outline" size={24} color={accent || colors.primary} />
          ) : (
            <Ionicons name={icon} size={24} color={accent || colors.primary} />
          )}
        </View>
        <View style={styles.toolInfo}>
          <Text style={styles.toolTitle}>{title}</Text>
          <Text style={[styles.toolDesc, loading && { color: accent || colors.primary, fontWeight: '600' }]}>
            {loading ? 'Procesando…' : desc}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: accent || colors.textSecondary }]}>›</Text>
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
    sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, letterSpacing: 1.2, marginBottom: 2 },
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
    toolIcon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    toolIconText: { fontSize: 22 },
    toolInfo: { flex: 1 },
    toolTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    toolDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    chevron: { fontSize: 24 },
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
    toast: {
      position: 'absolute',
      bottom: 24,
      left: Spacing.lg,
      right: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: Spacing.md,
      borderRadius: Radius.lg,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    toastIcon: { fontSize: 18 },
    toastText: { color: '#fff', fontWeight: '700', flex: 1, fontSize: 14 },
  });
}
