import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';

export async function copyToClipboard(text: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
        await Clipboard.write({ string: text });
    } else {
        await navigator.clipboard.writeText(text);
    }
}
