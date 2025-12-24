/**
 * Image Generation Module
 * Uses Fal AI for text-to-image generation
 */

const axios = require('axios');

const FAL_API_KEY = process.env.FAL_KEY;

/**
 * Post to Fal AI API (sync endpoint)
 * @param {string} model - Model identifier
 * @param {object} body - Request body
 * @returns {Promise<object>} API response
 */
async function postToFal(type, model, body) {
    // Use fal.run for synchronous requests
    const response = await axios.post(
        `https://fal.run/${model}`,
        body,
        {
            headers: {
                'Authorization': `Key ${FAL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000 // 2 minute timeout for image generation
        }
    );
    return response.data;
}

/**
 * Post to Fal AI Queue API (async with polling)
 * @param {string} model - Model identifier
 * @param {object} body - Request body
 * @returns {Promise<object>} API response
 */
async function postToFalQueue(model, body) {
    console.log(`[Fal AI] Submitting to queue: ${model}`);

    // Submit to queue
    const queueResponse = await axios.post(
        `https://queue.fal.run/${model}`,
        body,
        {
            headers: {
                'Authorization': `Key ${FAL_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );

    const { request_id, response_url, status_url } = queueResponse.data;
    console.log(`[Fal AI] Queued with request_id: ${request_id}`);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max (2s intervals)

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s

        try {
            const statusResponse = await axios.get(status_url, {
                headers: { 'Authorization': `Key ${FAL_API_KEY}` }
            });

            const { status } = statusResponse.data;
            console.log(`[Fal AI] Status: ${status}`);

            if (status === 'COMPLETED') {
                // Fetch the result
                const resultResponse = await axios.get(response_url, {
                    headers: { 'Authorization': `Key ${FAL_API_KEY}` }
                });
                return resultResponse.data;
            } else if (status === 'FAILED') {
                throw new Error('Fal AI generation failed');
            }
        } catch (error) {
            if (error.response?.status !== 202) {
                throw error;
            }
        }

        attempts++;
    }

    throw new Error('Fal AI generation timed out');
}

/**
 * Generate image from text prompt
 * @param {string} prompt - Image description
 * @param {string} aspectRatio - Aspect ratio (e.g., "16:9", "1:1")
 * @param {string} model - Fal AI model to use
 * @returns {Promise<string>} Generated image URL
 */
async function generateImage(prompt, aspectRatio = '16:9', model = 'fal-ai/z-image/turbo') {
    const imageSize = aspectRatio === '16:9' ? 'landscape_16_9' :
        aspectRatio === '9:16' ? 'portrait_16_9' : 'square';

    console.log(`[Fal AI] Generating image with model: ${model}`);
    console.log(`[Fal AI] Prompt: ${prompt.substring(0, 50)}...`);

    // Use queue endpoint for reliability
    const result = await postToFalQueue(model, {
        prompt,
        image_size: imageSize,
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: false
    });

    if (result.images && result.images.length > 0) {
        console.log(`[Fal AI] Image generated: ${result.images[0].url}`);
        return result.images[0].url;
    }
    throw new Error('No image generated');
}

module.exports = {
    generateImage,
    postToFal,
    postToFalQueue
};
