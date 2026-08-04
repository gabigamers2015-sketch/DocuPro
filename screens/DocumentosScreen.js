import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function DocumentosScreen() {
  const [cliente, setCliente] = useState('');
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');

  const generarFactura = async () => {
    const html = `
      <html>
        <body style="font-family: Helvetica; padding: 40px;">
          <h1>Factura</h1>
          <p><strong>Cliente:</strong> ${cliente}</p>
          <p><strong>Concepto:</strong> ${concepto}</p>
          <p><strong>Importe:</strong> ${importe} €</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
        </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.titulo}>Nueva Factura</Text>
      <TextInput style={styles.input} placeholder="Cliente" value={cliente} onChangeText={setCliente} />
      <TextInput style={styles.input} placeholder="Concepto" value={concepto} onChangeText={setConcepto} />
      <TextInput style={styles.input} placeholder="Importe (€)" value={importe} onChangeText={setImporte} keyboardType="numeric" />
      <Button title="Generar PDF" onPress={generarFactura} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
});
