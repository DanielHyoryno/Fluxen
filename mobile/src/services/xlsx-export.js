import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function sanitizeXlsxFilename(filename) {
    const safeName = String(filename || "water-usage.xlsx")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
        .trim();

    return safeName.toLowerCase().endsWith(".xlsx") ? safeName : `${safeName}.xlsx`;
}

export async function saveAndShareXlsx({ arrayBuffer, filename, contentType }) {
    const safeFilename = sanitizeXlsxFilename(filename);
    const file = new File(Paths.cache, safeFilename);

    file.create({ overwrite: true, intermediates: true });
    file.write(new Uint8Array(arrayBuffer));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
        await Sharing.shareAsync(file.uri, {
            mimeType: contentType || XLSX_MIME_TYPE,
            dialogTitle: "Export Water Usage Data",
            UTI: "org.openxmlformats.spreadsheetml.sheet",
        });
    }

    return {
        fileUri: file.uri,
        shared: canShare,
    };
}
