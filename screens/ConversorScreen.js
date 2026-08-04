import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export default function ConversorScreen() {
  const convertirImagenAPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
    if (result.canceled) return;

    const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const html = `<img src="data:image/jpeg;base64,${base64}" style="width:100%;" />`;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Conversor de Archivos</Text>
      <Button title="Imagen → PDF" onPress={convertirImagenAPdf} />
      {/* Añadir después: unir PDFs, comprimir PDF, PDF → imagen */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
});
