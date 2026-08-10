import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { sanitizeXlsxFilename, saveAndShareXlsx } from "../src/services/xlsx-export";

const mockCreate = jest.fn();
const mockWrite = jest.fn();

jest.mock("expo-file-system", () => ({
    Paths: { cache: "file:///cache/" },
    File: jest.fn().mockImplementation((directory, filename) => ({
        uri: `${directory}${filename}`,
        create: mockCreate,
        write: mockWrite,
    })),
}));

jest.mock("expo-sharing", () => ({
    isAvailableAsync: jest.fn(),
    shareAsync: jest.fn(),
}));

describe("XLSX mobile export", () => {
    beforeEach(() => {
        mockCreate.mockReset();
        mockWrite.mockReset();
        Sharing.isAvailableAsync.mockReset();
        Sharing.shareAsync.mockReset();
    });

    test("writes binary XLSX data to cache and opens the native share sheet", async () => {
        Sharing.isAvailableAsync.mockResolvedValue(true);
        Sharing.shareAsync.mockResolvedValue(undefined);
        const arrayBuffer = new Uint8Array([80, 75, 3, 4]).buffer;

        const result = await saveAndShareXlsx({
            arrayBuffer,
            filename: "DEVICE-01_2026-08.xlsx",
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        expect(File).toHaveBeenCalledWith(Paths.cache, "DEVICE-01_2026-08.xlsx");
        expect(mockCreate).toHaveBeenCalledWith({ overwrite: true, intermediates: true });
        expect(mockWrite).toHaveBeenCalledWith(new Uint8Array([80, 75, 3, 4]));
        expect(Sharing.shareAsync).toHaveBeenCalledWith(
            "file:///cache/DEVICE-01_2026-08.xlsx",
            expect.objectContaining({
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            })
        );
        expect(result).toEqual({
            fileUri: "file:///cache/DEVICE-01_2026-08.xlsx",
            shared: true,
        });
    });

    test("keeps the cached file available when native sharing is unavailable", async () => {
        Sharing.isAvailableAsync.mockResolvedValue(false);

        const result = await saveAndShareXlsx({
            arrayBuffer: new Uint8Array([1, 2]).buffer,
            filename: "usage.xlsx",
        });

        expect(Sharing.shareAsync).not.toHaveBeenCalled();
        expect(result).toEqual({ fileUri: "file:///cache/usage.xlsx", shared: false });
    });

    test("sanitizes filenames before writing to the cache directory", () => {
        expect(sanitizeXlsxFilename("../DEVICE:01/report")).toBe(".._DEVICE_01_report.xlsx");
    });
});
