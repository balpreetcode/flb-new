/**
 * OpenAI Image Generation Module
 * Uses OpenAI's gpt-image-1-mini for cheaper image generation
 * Supports both text-to-image and image-to-image (edit) workflows
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');

// OpenAI API configuration
// OpenAI API configuration
// OPENAI_API_KEY is read dynamically in functions
const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images';

// Available OpenAI image models (cheapest to most expensive)
const OPENAI_IMAGE_MODELS = {
    'gpt-image-1-mini': 'gpt-image-1-mini',     // Cheapest
    'gpt-image-1': 'gpt-image-1',               // Standard
    'gpt-image-1.5': 'gpt-image-1.5',           // Higher quality
    'dall-e-3': 'dall-e-3',                      // DALL-E 3
    'dall-e-2': 'dall-e-2'                       // Legacy
};

// Base directories
const BASE_DIR = path.resolve(__dirname, '../../..');
const TEMP_DIR = path.join(BASE_DIR, 'temp');
const OUTPUT_DIR = path.join(BASE_DIR, 'output');

// Ensure directories exist
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Download file from URL
 */
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
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
 * Compress image using FFmpeg (fallback if sharp not available)
 * Resizes to max width and converts to WEBP for smaller upload size
 */
async function compressImageWithFFmpeg(inputPath, outputPath, maxWidth = 1536, quality = 80) {
    return new Promise((resolve, reject) => {
        const cmd = `ffmpeg -y -i "${inputPath}" -vf "scale='min(${maxWidth},iw)':-1" -quality ${quality} "${outputPath}"`;
        exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                // Fallback: just copy the file if FFmpeg fails
                console.warn('FFmpeg compression failed, using original:', stderr);
                fs.copyFileSync(inputPath, outputPath);
            }
            resolve(outputPath);
        });
    });
}

/**
 * Compress image - tries sharp first, falls back to FFmpeg
 */
async function compressImage(inputPath, outputDir = TEMP_DIR, maxWidth = 1536, quality = 80) {
    const basename = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(outputDir, `compressed_${basename}_${Date.now()}.webp`);

    try {
        // Try to use sharp if available
        const sharp = require('sharp');
        const img = sharp(inputPath);
        const meta = await img.metadata();

        await img
            .resize({
                width: meta.width && meta.width > maxWidth ? maxWidth : undefined,
                withoutEnlargement: true,
            })
            .toFormat('webp', { quality })
            .toFile(outputPath);

        return outputPath;
    } catch (err) {
        // sharp not installed, use FFmpeg fallback
        console.log('Sharp not available, using FFmpeg for compression');
        return compressImageWithFFmpeg(inputPath, outputPath, maxWidth, quality);
    }
}

/**
 * Make OpenAI API request
 */
async function openaiRequest(endpoint, body, isFormData = false) {
    const axios = require('axios');

    console.log(`[OpenAI Request] POST ${OPENAI_IMAGES_URL}${endpoint}`);
    console.log(`[OpenAI Request] Body keys: ${Object.keys(body).join(', ')}`);
    console.log(`[OpenAI Request] API Key present: ${!!process.env.OPENAI_API_KEY}`);

    const config = {
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
        },
        timeout: 300000
    };

    if (!isFormData) {
        config.headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await axios.post(`${OPENAI_IMAGES_URL}${endpoint}`, body, config);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error(`[OpenAI Error] Status: ${error.response.status}`);
            console.error(`[OpenAI Error] Data:`, JSON.stringify(error.response.data));
        } else {
            console.error(`[OpenAI Error] Message: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Text to Image using OpenAI
 * Uses gpt-image-1-mini by default (cheapest option)
 * 
 * @param {string} prompt - Text description of the image to generate
 * @param {object} options - Generation options
 * @returns {Promise<string>} - URL or base64 of generated image
 */
async function generateImageOpenAI(prompt, options = {}) {
    const {
        model = 'gpt-image-1-mini',
        size = '1024x1024',
        quality = 'auto',
        responseFormat = 'b64_json', // 'url' or 'b64_json'
        n = 1
    } = options;

    console.log(`[OpenAI Text-to-Image] Using model: ${model}`);

    const body = {
        model: OPENAI_IMAGE_MODELS[model] || model,
        prompt,
        size,
        n
    };

    // DALL-E 3 supports quality parameter
    if (model === 'dall-e-3') {
        body.quality = quality;
    }

    const result = await openaiRequest('/generations', body);

    if (result.data && result.data.length > 0) {
        const imageData = result.data[0];

        // If response is base64, save to file and return URL
        if (imageData.b64_json) {
            const timestamp = Date.now();
            const outputPath = path.join(OUTPUT_DIR, `openai_gen_${timestamp}.png`);
            fs.writeFileSync(outputPath, Buffer.from(imageData.b64_json, 'base64'));
            return `http://localhost:3002/output/openai_gen_${timestamp}.png`;
        }

        return imageData.url;
    }

    throw new Error('No image generated from OpenAI');
}

/**
 * Image to Image (Edit) using OpenAI
 * Takes one or more input images and a prompt describing the edit
 * 
 * @param {string|string[]} imageInputs - Image URLs or local paths
 * @param {string} prompt - Description of the desired edit
 * @param {object} options - Edit options
 * @returns {Promise<string>} - URL of edited image
 */
async function editImageOpenAI(imageInputs, prompt, options = {}) {
    const {
        model = 'gpt-image-1-mini',
        size = '1024x1024',
        compress = true,
        maxWidth = 1536,
        quality = 80
    } = options;

    console.log(`[OpenAI Image-to-Image] Using model: ${model}`);

    // Handle single image or array
    const images = Array.isArray(imageInputs) ? imageInputs : [imageInputs];
    const localPaths = [];

    // Download remote images and optionally compress
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        let localPath;

        if (img.startsWith('http://') || img.startsWith('https://')) {
            localPath = path.join(TEMP_DIR, `edit_input_${Date.now()}_${i}.png`);
            await downloadFile(img, localPath);
        } else {
            localPath = img;
        }

        // Compress to reduce upload size
        if (compress) {
            const compressedPath = await compressImage(localPath, TEMP_DIR, maxWidth, quality);
            localPaths.push(compressedPath);

            // Clean up original download if different
            if (compressedPath !== localPath && img.startsWith('http')) {
                try { fs.unlinkSync(localPath); } catch (e) { }
            }
        } else {
            localPaths.push(localPath);
        }
    }

    // Use FormData for file uploads
    const FormData = require('form-data');
    const formData = new FormData();

    formData.append('model', OPENAI_IMAGE_MODELS[model] || model);
    formData.append('prompt', prompt);
    formData.append('size', size);

    // Add images
    for (const imgPath of localPaths) {
        formData.append('image', fs.createReadStream(imgPath));
    }

    const axios = require('axios');
    const response = await axios.post(`${OPENAI_IMAGES_URL}/edits`, formData, {
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            ...formData.getHeaders()
        },
        timeout: 300000
    });

    // Clean up temp files
    for (const p of localPaths) {
        try { fs.unlinkSync(p); } catch (e) { }
    }

    const result = response.data;
    if (result.data && result.data.length > 0) {
        const imageData = result.data[0];

        if (imageData.b64_json) {
            const timestamp = Date.now();
            const outputPath = path.join(OUTPUT_DIR, `openai_edit_${timestamp}.png`);
            fs.writeFileSync(outputPath, Buffer.from(imageData.b64_json, 'base64'));
            return `http://localhost:3002/output/openai_edit_${timestamp}.png`;
        }

        return imageData.url;
    }

    throw new Error('No image generated from OpenAI edit');
}

/**
 * List available OpenAI image models
 */
function getAvailableModels() {
    return Object.keys(OPENAI_IMAGE_MODELS);
}

module.exports = {
    generateImageOpenAI,
    editImageOpenAI,
    compressImage,
    getAvailableModels,
    OPENAI_IMAGE_MODELS
};
