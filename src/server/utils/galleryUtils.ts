import path from 'path';
import fs from 'fs';
import config from 'config';
import { safeJoin } from './safePath';
import { comfyUIAxios } from './comfyAPIUtils/comfyUIAxios';

function getMiniBridgeToken(): string | null {
    if (!config.has('minibridge_token')) {
        return null;
    }

    const token = config.get<string>('minibridge_token');
    if (!token || typeof token !== 'string' || token.trim() === '') {
        return null;
    }

    return token.trim();
}

function getRelativeTimeText(timestamp: number): string {
    const now = Date.now();
    const secondsPast = Math.floor((now - timestamp) / 1000);

    if (secondsPast < 60) {
        return `${secondsPast} second(s) ago`;
    }
    if (secondsPast < 3600) {
        const minutesAgo = Math.floor(secondsPast / 60);
        return `${minutesAgo} minute(s) ago`;
    }
    if (secondsPast < 86400) {
        const hoursAgo = Math.floor(secondsPast / 3600);
        return `${hoursAgo} hours(s) ago`;
    }
    if (secondsPast < 604800) {
        const daysAgo = Math.floor(secondsPast / 86400);
        return `${daysAgo} days(s) ago`;
    }
    if (secondsPast < 2628000) {
        const weeksAgo = Math.floor(secondsPast / 604800);
        return `${weeksAgo} week(s) ago`;
    }
    if (secondsPast < 31536000) {
        const monthsAgo = Math.floor(secondsPast / 2628000);
        return `${monthsAgo} month(s) ago`;
    }
    const yearsAgo = Math.floor(secondsPast / 31536000);
    return `${yearsAgo} year(s) ago`;
}

/**
 * @typedef {object} GalleryImageData
 * @property {string} path - The ComfyUIMini url path for the image file.
 * @property {number} time - Latest file modification time in ms since Unix epoch.
 * @property {string} timeText - Human-readable relative time since last image mofification, e.g. '2 hour(s) ago'.
 */

/**
 * @typedef {object} GalleryPageData
 * @property {Object} scanned - List of images and available subfolders.
 * @property {GalleryImageData[]} scanned.images - List of image data.
 * @property {string[]} scanned.subfolders - List of subfolders in the currently opened subfolder.
 * @property {Object} pageInfo - Info around current page index.
 * @property {number} pageInfo.prevPage - Previous page number.
 * @property {number} pageInfo.currentPage - Current page number.
 * @property {number} pageInfo.nextPage - Next page number.
 * @property {number} pageInfo.totalPages - Total number of pages.
 */

/**
 * Gets a list of images at the page.
 *
 * Returns images in the range `(page * itemsPerPage)` to `(page * itemsPerPage) + itemsPerPage`
 * @param {number} page - Page number to retreive.
 * @param {string} subfolder - Subfolder within gallery directory.
 * @param {number} itemsPerPage - Images sent per page.
 * @returns {GalleryPageData} - Object containing paginated images and additional page info.
 */
function getGalleryPageDataFromFs(page = 0, subfolder = '', itemsPerPage = 20) {
    const imageOutputPath = config.get('output_dir');

    if (!imageOutputPath || !(typeof imageOutputPath === 'string')) {
        return {
            error: 'Output directory not set properly in config.',
            scanned: { subfolders: [], images: [] },
            pageInfo: { prevPage: 0, currentPage: 0, nextPage: 0, totalPages: 0 },
        };
    }

    if (!fs.existsSync(imageOutputPath)) {
        return {
            error: 'Invalid output directory.',
            scanned: { subfolders: [], images: [] },
            pageInfo: { prevPage: 0, currentPage: 0, nextPage: 0, totalPages: 0 },
        };
    }

    let targetPath: string;
    try {
        targetPath = safeJoin(imageOutputPath, subfolder);
    } catch {
        return {
            error: 'Invalid subfolder path.',
            scanned: { subfolders: [], images: [] },
            pageInfo: { prevPage: 0, currentPage: 0, nextPage: 0, totalPages: 0 },
        };
    }

    if (!fs.existsSync(targetPath)) {
        return {
            error: 'Invalid subfolder path.',
            scanned: { subfolders: [], images: [] },
            pageInfo: { prevPage: 0, currentPage: 0, nextPage: 0, totalPages: 0 },
        };
    }

    const files = fs.readdirSync(targetPath);

    const filteredFiles = files
        .filter((file) => {
            const ext = path.extname(file).toLowerCase();
            const isFileImage = ['.jpg', '.jpeg', '.png', '.ppm', '.bmp', '.pgm', '.tif', '.tiff', '.webp'].includes(
                ext
            );

            return isFileImage;
        })
        .map((file) => {
            const mtime = fs.statSync(path.join(targetPath, file)).mtime.getTime();
            const qs = new URLSearchParams({ filename: file, subfolder: subfolder, type: 'output' });

            return {
                path: `/comfyui/image?${qs.toString()}`,
                time: mtime,
                timeText: getRelativeTimeText(mtime),
            };
        })
        .sort((a, b) => b.time - a.time);

    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    const paginatedFiles = filteredFiles.slice(startIndex, endIndex);

    let subfolders: string[];
    try {
        subfolders = fs
            .readdirSync(imageOutputPath)
            .filter((item) => fs.statSync(path.join(imageOutputPath, item)).isDirectory());
    } catch (error) {
        console.log('Error getting subfolders:', error);
        subfolders = [];
    }

    const totalPages = Math.max(0, Math.ceil(filteredFiles.length / itemsPerPage) - 1);
    const prevPage = page - 1 >= 0 ? page - 1 : 0;
    const nextPage = page + 1 <= totalPages ? page + 1 : totalPages;

    return {
        scanned: { subfolders: subfolders, images: paginatedFiles },
        pageInfo: { prevPage: prevPage, currentPage: page, nextPage: nextPage, totalPages: totalPages },
        error: null,
    };
}

async function getGalleryPageDataFromMiniBridge(page = 0, subfolder = '', itemsPerPage = 20) {
    const qs = new URLSearchParams({ limit: '200' });
    if (subfolder && subfolder.trim() !== '') {
        qs.set('subfolder', subfolder);
    }

    const token = getMiniBridgeToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    try {
        const resp = await comfyUIAxios.get(`/minibridge/outputs?${qs.toString()}`, { headers });
        const payload = resp?.data as
            | {
                  ok: true;
                  items: Array<{ filename: string; subfolder: string; mtime: number; kind: string }>;
                  subfolders?: string[];
              }
            | { ok: false; error?: string };

        if (!payload || !('ok' in payload) || payload.ok !== true) {
            return {
                error: 'MiniBridge returned an error.',
                scanned: { subfolders: [], images: [] },
                pageInfo: { prevPage: 0, currentPage: 0, nextPage: 0, totalPages: 0 },
            };
        }

        const images = (payload.items || [])
            .filter((it) => it.kind === 'image')
            .map((it) => {
                const mtimeMs = Number(it.mtime) * 1000;
                const qs = new URLSearchParams({ filename: it.filename, subfolder: it.subfolder || '', type: 'output' });
                return {
                    path: `/comfyui/image?${qs.toString()}`,
                    time: mtimeMs,
                    timeText: getRelativeTimeText(mtimeMs),
                };
            })
            .sort((a, b) => b.time - a.time);

        const startIndex = page * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedFiles = images.slice(startIndex, endIndex);

        const totalPages = Math.max(0, Math.ceil(images.length / itemsPerPage) - 1);
        const prevPage = page - 1 >= 0 ? page - 1 : 0;
        const nextPage = page + 1 <= totalPages ? page + 1 : totalPages;

        return {
            scanned: { subfolders: payload.subfolders || [], images: paginatedFiles },
            pageInfo: { prevPage: prevPage, currentPage: page, nextPage: nextPage, totalPages: totalPages },
            error: null,
        };
    } catch (err) {
        return {
            error: 'MiniBridge is unavailable. Ensure ComfyUI-MiniBridge is installed in ComfyUI.',
            scanned: { subfolders: [], images: [] },
            pageInfo: { prevPage: 0, currentPage: 0, nextPage: 0, totalPages: 0 },
        };
    }
}

async function getGalleryPageData(page = 0, subfolder = '', itemsPerPage = 20) {
    const imageOutputPath = config.get('output_dir');

    // Prefer filesystem listing when available (best UX + unlimited paging).
    if (typeof imageOutputPath === 'string' && imageOutputPath.trim() !== '' && fs.existsSync(imageOutputPath)) {
        return getGalleryPageDataFromFs(page, subfolder, itemsPerPage);
    }

    // Fallback for remote ComfyUI instances: list outputs via /minibridge/outputs.
    return await getGalleryPageDataFromMiniBridge(page, subfolder, itemsPerPage);
}

export { getGalleryPageData };
