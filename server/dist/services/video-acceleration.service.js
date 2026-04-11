import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { FFMPEG_BIN } from '../config/media-tools.config.js';
import { VIDEO_ACCELERATION, } from '../config/video-processing.config.js';
import { logger } from '../utils/logger.js';
const execFileAsync = promisify(execFile);
const COMMAND_MAX_BUFFER = 4 * 1024 * 1024;
export const NVIDIA_GPU_HWACCEL = 'cuda';
export const NVIDIA_GPU_VIDEO_ENCODER = 'h264_nvenc';
export const NVIDIA_GPU_PRESET = 'medium';
export const NVIDIA_GPU_TUNE = 'hq';
export const NVIDIA_GPU_CQ = 18;
let cachedNvidiaCapabilityPromise = null;
async function runFfmpegTextCommand(args) {
    const { stdout } = await execFileAsync(FFMPEG_BIN, args, {
        maxBuffer: COMMAND_MAX_BUFFER,
    });
    return stdout;
}
async function runNvidiaSmokeTest() {
    await execFileAsync(FFMPEG_BIN, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=64x64:r=24',
        '-t',
        '0.2',
        '-vf',
        'hwupload_cuda,scale_cuda=64:64:format=nv12,hwdownload,format=nv12',
        '-an',
        '-c:v',
        NVIDIA_GPU_VIDEO_ENCODER,
        '-preset',
        NVIDIA_GPU_PRESET,
        '-tune',
        NVIDIA_GPU_TUNE,
        '-rc',
        'vbr',
        '-cq',
        String(NVIDIA_GPU_CQ),
        '-b:v',
        '0',
        '-f',
        'null',
        '-',
    ], {
        maxBuffer: COMMAND_MAX_BUFFER,
    });
}
async function detectNvidiaCapability() {
    try {
        const [hwaccels, encoders, filters] = await Promise.all([
            runFfmpegTextCommand(['-hide_banner', '-hwaccels']),
            runFfmpegTextCommand(['-hide_banner', '-encoders']),
            runFfmpegTextCommand(['-hide_banner', '-filters']),
        ]);
        if (!hwaccels.includes(NVIDIA_GPU_HWACCEL)) {
            return {
                available: false,
                reason: `FFmpeg does not report the "${NVIDIA_GPU_HWACCEL}" hardware acceleration backend.`,
            };
        }
        if (!encoders.includes(NVIDIA_GPU_VIDEO_ENCODER)) {
            return {
                available: false,
                reason: `FFmpeg does not report the "${NVIDIA_GPU_VIDEO_ENCODER}" encoder.`,
            };
        }
        if (!filters.includes('scale_cuda')) {
            return {
                available: false,
                reason: 'FFmpeg does not report the "scale_cuda" filter.',
            };
        }
        await runNvidiaSmokeTest();
        return {
            available: true,
            reason: 'FFmpeg reported CUDA + NVENC support, and the NVIDIA smoke test completed successfully.',
        };
    }
    catch (error) {
        const err = error;
        logger.warn('acceleration', 'NVIDIA capability detection failed', {
            binary: FFMPEG_BIN,
            stderr: err.stderr,
            error: err,
        });
        return {
            available: false,
            reason: err.stderr?.trim() ||
                err.message ||
                'FFmpeg could not complete the NVIDIA GPU capability check.',
        };
    }
}
async function getNvidiaCapability() {
    if (!cachedNvidiaCapabilityPromise) {
        cachedNvidiaCapabilityPromise = detectNvidiaCapability();
    }
    return cachedNvidiaCapabilityPromise;
}
export async function resolveProcessingAcceleration() {
    if (VIDEO_ACCELERATION === 'cpu') {
        return {
            requestedMode: VIDEO_ACCELERATION,
            resolvedMode: 'cpu',
            gpuAvailable: false,
            reason: 'CPU processing was forced by VIDEO_ACCELERATION=cpu.',
        };
    }
    const capability = await getNvidiaCapability();
    if (capability.available) {
        return {
            requestedMode: VIDEO_ACCELERATION,
            resolvedMode: 'gpu',
            gpuAvailable: true,
            reason: capability.reason,
        };
    }
    return {
        requestedMode: VIDEO_ACCELERATION,
        resolvedMode: 'cpu',
        gpuAvailable: false,
        reason: VIDEO_ACCELERATION === 'gpu'
            ? `VIDEO_ACCELERATION=gpu was requested, but the server is falling back to CPU. ${capability.reason}`
            : `GPU acceleration is unavailable, so auto mode is falling back to CPU. ${capability.reason}`,
    };
}
//# sourceMappingURL=video-acceleration.service.js.map