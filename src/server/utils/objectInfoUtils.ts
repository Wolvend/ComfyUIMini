import { getRawObjectInfo } from './comfyAPIUtils';
import { NormalisedComfyInputInfo, ProcessedObjectInfo } from '@shared/types/ComfyObjectInfo';

async function getProcessedObjectInfo(): Promise<ProcessedObjectInfo | null> {
    const rawObjectInfo = await getRawObjectInfo();

    if (rawObjectInfo === null) {
        return null;
    }

    const processedObjectInfo: ProcessedObjectInfo = {};

    for (const [nodeName, nodeInfo] of Object.entries(rawObjectInfo)) {
        const requiredInputs = nodeInfo.input.required;
        const optionalInputs = nodeInfo.input.optional;

        const allInputs = {
            ...(requiredInputs ?? {}),
            ...(optionalInputs ?? {}),
        };

        for (const [inputName, inputInfo] of Object.entries(allInputs)) {
            const normalisedInfo = getNormalisedInfo(inputInfo);

            if (normalisedInfo.userAccessible) {
                if (!processedObjectInfo[nodeName]) {
                    processedObjectInfo[nodeName] = {};
                }

                processedObjectInfo[nodeName][inputName] = normalisedInfo;
            }
        }
    }

    return processedObjectInfo;
}

/**
 * ComfyUI uses weirdly different formats for each input type,
 * e.g. For most inputs, `inputInfo[0]` is a string containing the input type, for arrays, its the list of options.
 *
 * However, arrays may also *sometimes* have a second element with other options such as `tooltip`, `default`, or `image_upload`
 * that determines if the input has an upload input or is just a list of options.
 *
 * @param {unknown[]} inputInfo
 * @returns {NormalisedComfyInputInfo}
 */
function getNormalisedInfo(inputInfo: unknown[]): NormalisedComfyInputInfo {
    const normalisedInfo: Partial<NormalisedComfyInputInfo> = {
        userAccessible: false,
    };

    const first = inputInfo[0];

    if (Array.isArray(first)) {
        normalisedInfo.userAccessible = true;
        normalisedInfo.type = 'ARRAY';
        normalisedInfo.list = first.map((v) => String(v));

        const options = inputInfo[1];
        if (options && typeof options === 'object') {
            const opts = options as Record<string, unknown>;

            if (opts.default !== undefined && opts.default !== null) {
                normalisedInfo.default = String(opts.default);
            }

            normalisedInfo.imageUpload = Boolean(opts.image_upload);

            if (opts.tooltip !== undefined && opts.tooltip !== null) {
                normalisedInfo.tooltip = String(opts.tooltip);
            }
        }

        return normalisedInfo as NormalisedComfyInputInfo;
    }

    if (typeof first === 'string' && ['INT', 'FLOAT', 'STRING'].includes(first)) {
        // data can contain default, tooltip for any type, min, max for int, and min max, and step for ints, and multiline, dynamicPrompts for strings
        normalisedInfo.userAccessible = true;
        normalisedInfo.type = first as 'INT' | 'FLOAT' | 'STRING';

        const options = inputInfo[1];
        if (options && typeof options === 'object') {
            const opts = options as Record<string, unknown>;

            if (opts.default !== undefined && opts.default !== null) {
                normalisedInfo.default = String(opts.default);
            }

            if (opts.tooltip !== undefined && opts.tooltip !== null) {
                normalisedInfo.tooltip = String(opts.tooltip);
            }

            normalisedInfo.min = typeof opts.min === 'number' ? opts.min : undefined;
            normalisedInfo.max = typeof opts.max === 'number' ? opts.max : undefined;
            normalisedInfo.step = typeof opts.step === 'number' ? opts.step : undefined;
            normalisedInfo.multiline = typeof opts.multiline === 'boolean' ? opts.multiline : undefined;
            normalisedInfo.dynamicPrompts = typeof opts.dynamicPrompts === 'boolean' ? opts.dynamicPrompts : undefined;
        }

        return normalisedInfo as NormalisedComfyInputInfo;
    }

    return normalisedInfo as NormalisedComfyInputInfo;
}

export { getProcessedObjectInfo };
