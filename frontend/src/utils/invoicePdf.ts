import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { Booking, BookingInvoice } from '../services/bookings';
import { generateInvoiceHtml } from './invoiceHtml';

export { generateInvoiceHtml } from './invoiceHtml';

/** Generates the invoice PDF and opens the native share/save sheet. */
export async function downloadInvoicePdf(
  booking: Booking,
  invoice: BookingInvoice
): Promise<void> {
  try {
    const html = generateInvoiceHtml(booking, invoice);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Invoice ${invoice.invoiceNumber}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Invoice ready', `Saved to: ${uri}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Could not generate invoice';
    Alert.alert('Download failed', msg);
  }
}
