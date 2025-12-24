/**
 * FFmpeg Utilities Module
 * Handles video processing with FFmpeg
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Base directories - relative to project root
const BASE_DIR = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = path.join(BASE_DIR, 'output');
const TEMP_DIR = path.join(BASE_DIR, 'temp');

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

/**
 * Download a file from URL to local path
 * @param {string} url - Source URL
 * @param {string} destPath - Destination path
 * @returns {Promise<string>} Downloaded file path
 */
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(url)) {
            fs.copyFile(url, destPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(destPath);
            });
            return;
        }
        const file = fs.createWriteStream(destPath);
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(destPath);
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

/**
 * Execute FFmpeg command
 * @param {string} command - FFmpeg command to execute
 * @returns {Promise<string>} Command output
 */
function runFFmpeg(command) {
    return new Promise((resolve, reject) => {
        console.log('Running FFmpeg:', command);
        exec(command, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error('FFmpeg error:', stderr);
                reject(new Error(stderr || error.message));
            } else {
                resolve(stdout);
            }
        });
    });
}

async function concatVideoUrls(urls) {
    if (!urls || urls.length === 0) {
        throw new Error('No video URLs provided for concatenation');
    }
    if (urls.length === 1) {
        return urls[0];
    }

    const timestamp = Date.now();
    const localPaths = [];
    const inputArgs = [];

    for (let i = 0; i < urls.length; i++) {
        const localPath = path.join(TEMP_DIR, `concat_video_${timestamp}_${i}.mp4`);
        await downloadFile(urls[i], localPath);
        localPaths.push(localPath);
        inputArgs.push(`-i "${localPath}"`);
    }

    const concatInputs = localPaths.map((_, index) => `[${index}:v]`).join('');
    const outputPath = path.join(TEMP_DIR, `concat_video_${timestamp}.mp4`);
    const filter = `"${concatInputs}concat=n=${localPaths.length}:v=1:a=0[v]"`;
    const command = `ffmpeg -y ${inputArgs.join(' ')} -filter_complex ${filter} -map "[v]" -c:v libx264 -pix_fmt yuv420p "${outputPath}"`;

    await runFFmpeg(command);
    localPaths.forEach(filePath => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    return outputPath;
}

async function concatAudioUrls(urls) {
    if (!urls || urls.length === 0) {
        throw new Error('No audio URLs provided for concatenation');
    }
    if (urls.length === 1) {
        return urls[0];
    }

    const timestamp = Date.now();
    const listPath = path.join(TEMP_DIR, `concat_audio_${timestamp}.txt`);
    const outputPath = path.join(TEMP_DIR, `concat_audio_${timestamp}.m4a`);
    const localPaths = [];

    for (let i = 0; i < urls.length; i++) {
        const localPath = path.join(TEMP_DIR, `concat_audio_${timestamp}_${i}.mp3`);
        await downloadFile(urls[i], localPath);
        localPaths.push(localPath);
    }

    const listContent = localPaths.map(filePath => `file '${filePath.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listPath, listContent);

    const command = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c:a aac "${outputPath}"`;
    await runFFmpeg(command);

    localPaths.forEach(filePath => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    if (fs.existsSync(listPath)) fs.unlinkSync(listPath);

    return outputPath;
}

/**
 * Get audio duration using ffprobe
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<number>} Duration in seconds
 */
function getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
        exec(`ffprobe -i "${audioPath}" -show_entries format=duration -v quiet -of csv="p=0"`, (error, stdout) => {
            if (error) {
                reject(error);
            } else {
                resolve(parseFloat(stdout.trim()));
            }
        });
    });
}

/**
 * Cut video to specified duration
 * @param {string} inputPath - Input video path
 * @param {string} outputPath - Output video path
 * @param {number} duration - Target duration in seconds
 * @returns {Promise<string>} Output path
 */
async function cutVideo(inputPath, outputPath, duration) {
    await runFFmpeg(`ffmpeg -y -i "${inputPath}" -t ${duration} -c copy "${outputPath}"`);
    return outputPath;
}

/**
 * Generate video transition between two images
 * @param {string} image1Path - First image path
 * @param {string} image2Path - Second image path
 * @param {string} outputPath - Output video path
 * @param {number} duration - Duration in seconds
 * @param {string} transitionType - Type of transition
 * @returns {Promise<string>} Output path
 */
async function generateTransition(image1Path, image2Path, outputPath, duration = 5, transitionType = 'fade') {
    const halfDuration = duration / 2;

    // Create a transition video using xfade filter
    const cmd = `ffmpeg -y -loop 1 -t ${halfDuration} -i "${image1Path}" -loop 1 -t ${halfDuration} -i "${image2Path}" -filter_complex "[0:v][1:v]xfade=transition=${transitionType}:duration=0.5:offset=${halfDuration - 0.5},format=yuv420p[v]" -map "[v]" -c:v libx264 -pix_fmt yuv420p "${outputPath}"`;

    await runFFmpeg(cmd);
    return outputPath;
}

/**
 * Escape text for FFmpeg drawtext filter
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeForDrawtext(text) {
    return text
        .replace(/\\/g, '\\\\\\\\')
        .replace(/'/g, "'\\''")
        .replace(/:/g, '\\:')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]');
}

/**
 * Get subtitle Y position for FFmpeg
 * @param {string} position - Position (top, center, bottom)
 * @returns {string} FFmpeg Y expression
 */
function getSubtitleY(position) {
    switch (position) {
        case 'top': return 'h*0.1';
        case 'center': return '(h-text_h)/2';
        case 'bottom':
        default: return 'h*0.85';
    }
}

/**
 * Clean hex color for FFmpeg
 * @param {string} color - Color with or without #
 * @returns {string} Color without #
 */
function cleanColor(color) {
    return color.replace('#', '');
}

/**
 * Compose video with audio and subtitles
 * @param {object} options - Composition options
 * @returns {Promise<object>} Result with video URL
 */
async function composeVideo(options) {
    const {
        videoUrl,
        speechUrl,
        speechVolume = 1.0,
        musicUrl,
        musicVolume = 0.5,
        subtitleText,
        subtitlePosition = 'bottom',
        subtitleFont = 'Arial',
        subtitleColor = '#ffffff',
        subtitleSize = 24
    } = options;

    const timestamp = Date.now();
    const videoPath = path.join(TEMP_DIR, `video_${timestamp}.mp4`);
    const speechPath = path.join(TEMP_DIR, `speech_${timestamp}.mp3`);
    const musicPath = path.join(TEMP_DIR, `music_${timestamp}.mp3`);
    const outputPath = path.join(OUTPUT_DIR, `composed_${timestamp}.mp4`);

    try {
        console.log('Starting composition...');

        // Step 1: Download video
        console.log('Downloading video...');
        await downloadFile(videoUrl, videoPath);

        // Build FFmpeg command
        let inputs = [`-i "${videoPath}"`];
        let filterParts = [];
        let audioMixInputs = [];
        let inputIndex = 1;

        // Step 2: Download and add speech audio
        if (speechUrl) {
            console.log('Downloading speech...');
            await downloadFile(speechUrl, speechPath);
            inputs.push(`-i "${speechPath}"`);
            filterParts.push(`[${inputIndex}:a]volume=${speechVolume}[speech]`);
            audioMixInputs.push('[speech]');
            inputIndex++;
        }

        // Step 3: Download and add music audio
        if (musicUrl) {
            console.log('Downloading music...');
            await downloadFile(musicUrl, musicPath);
            inputs.push(`-i "${musicPath}"`);
            filterParts.push(`[${inputIndex}:a]volume=${musicVolume}[music]`);
            audioMixInputs.push('[music]');
            inputIndex++;
        }

        // Step 4: Build filter complex
        let filterComplex = '';
        let videoFilters = [];

        if (subtitleText) {
            const escapedText = escapeForDrawtext(subtitleText);
            const yPos = getSubtitleY(subtitlePosition);
            const hexColor = cleanColor(subtitleColor);
            videoFilters.push(
                `drawtext=text='${escapedText}':fontfile=/System/Library/Fonts/Helvetica.ttc:fontsize=${subtitleSize}:fontcolor=0x${hexColor}:x=(w-text_w)/2:y=${yPos}:box=1:boxcolor=black@0.5:boxborderw=5`
            );
        }

        if (videoFilters.length > 0) {
            filterParts.push(`[0:v]${videoFilters.join(',')}[vout]`);
        }

        if (audioMixInputs.length > 0) {
            filterParts.push(`${audioMixInputs.join('')}amix=inputs=${audioMixInputs.length}:duration=longest[aout]`);
        }

        // Build final command
        let ffmpegCmd = `ffmpeg -y ${inputs.join(' ')}`;

        if (filterParts.length > 0) {
            filterComplex = filterParts.join(';');
            ffmpegCmd += ` -filter_complex "${filterComplex}"`;
        }

        // Map outputs
        if (videoFilters.length > 0) {
            ffmpegCmd += ' -map "[vout]"';
        } else {
            ffmpegCmd += ' -map 0:v';
        }

        if (audioMixInputs.length > 0) {
            ffmpegCmd += ' -map "[aout]"';
        } else {
            ffmpegCmd += ' -an';
        }

        ffmpegCmd += ` -c:v libx264 -c:a aac -shortest "${outputPath}"`;

        // Step 5: Run FFmpeg
        console.log('Composing video...');
        await runFFmpeg(ffmpegCmd);

        // Step 6: Clean up temp files
        [videoPath, speechPath, musicPath].forEach(f => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
        });

        const outputUrl = `http://localhost:3001/output/composed_${timestamp}.mp4`;
        console.log('Composition complete:', outputUrl);

        return {
            success: true,
            videoUrl: outputUrl,
            localPath: outputPath
        };

    } catch (error) {
        console.error('Composition failed:', error);

        // Clean up on error
        [videoPath, speechPath, musicPath, outputPath].forEach(f => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
        });

        throw error;
    }
}

module.exports = {
    downloadFile,
    runFFmpeg,
    getAudioDuration,
    cutVideo,
    generateTransition,
    escapeForDrawtext,
    getSubtitleY,
    cleanColor,
    composeVideo,
    concatVideoUrls,
    concatAudioUrls,
    OUTPUT_DIR,
    TEMP_DIR
};
