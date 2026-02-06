import { comfyUIAxios } from '../comfyUIAxios';
import fs from 'fs';
import path from 'path';
import config from 'config';
import { safeJoin } from 'server/utils/safePath';

function mimeFromExt(ext: string): string {
    switch (ext.toLowerCase()) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.webp':
            return 'image/webp';
        case '.bmp':
            return 'image/bmp';
        case '.tif':
        case '.tiff':
            return 'image/tiff';
        default:
            return 'application/octet-stream';
    }
}

async function getImage(filename: string, subfolder: string, type: string) {
    const params = new URLSearchParams({ filename, subfolder, type });

    try {
        const response = await comfyUIAxios.get(`/view?${params.toString()}`, { responseType: 'arraybuffer' });

        return response;
    } catch (err: unknown) {
        if (err instanceof Error && 'code' in err) {
            if (err.code === 'ECONNREFUSED') {
                // Fallback if ComfyUI is unavailable
                if (type === 'output') {
                    const outputDir = config.get('output_dir');

                    if (!outputDir || typeof outputDir !== 'string') {
                        return null;
                    }

                    let fallbackPath: string;
                    try {
                        fallbackPath = safeJoin(outputDir, subfolder, filename);
                    } catch {
                        return null;
                    }

                    const readFile = fs.readFileSync(fallbackPath);

                    return {
                        data: readFile,
                        headers: {
                            'content-type': mimeFromExt(path.extname(filename)),
                            'content-length': readFile.length,
                        },
                    };
                }
            }
        }

        console.error('Unknown error when fetching image:', err);
        return null;
    }
}

export default getImage;
