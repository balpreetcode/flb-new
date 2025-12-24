/**
 * Video Generation Module
 * Uses Fal AI for image-to-video generation
 */

const axios = require('axios');

const FAL_API_KEY = process.env.FAL_KEY;

/**
 * Post to Fal AI Queue API with polling
 * @param {string} model - Model identifier
 * @param {object} body - Request body
 * @returns {Promise<object>} API response
 */
async function postToFalQueue(model, body) {
    console.log(`[Fal AI Video] Submitting to queue: ${model}`);

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
    console.log(`[Fal AI Video] Queued with request_id: ${request_id}`);

    // Poll for completion (video takes longer)
    let attempts = 0;
    const maxAttempts = 120; // 4 minutes max (2s intervals)

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const statusResponse = await axios.get(status_url, {
                headers: { 'Authorization': `Key ${FAL_API_KEY}` }
            });

            const { status } = statusResponse.data;
            if (attempts % 5 === 0) {
                console.log(`[Fal AI Video] Status: ${status} (attempt ${attempts})`);
            }

            if (status === 'COMPLETED') {
                const resultResponse = await axios.get(response_url, {
                    headers: { 'Authorization': `Key ${FAL_API_KEY}` }
                });
                return resultResponse.data;
            } else if (status === 'FAILED') {
                throw new Error('Fal AI video generation failed');
            }
        } catch (error) {
            if (error.response?.status !== 202) {
                throw error;
            }
        }

        attempts++;
    }

    throw new Error('Fal AI video generation timed out');
}

/**
 * Generate video from image
 * @param {string} imageUrl - Source image URL
 * @param {string} prompt - Motion/animation description
 * @param {number} duration - Video duration in seconds
 * @param {string} model - Fal AI model to use
 * @returns {Promise<string>} Generated video URL
 */
async function generateVideo(imageUrl, prompt = '', duration = 5, model = 'fal-ai/ltxv-13b-098-distilled/image-to-video') {
    const urlStr = typeof imageUrl === 'string' ? imageUrl : String(imageUrl);
    console.log(`[Fal AI Video] Image to video from: ${urlStr.substring(0, 50)}...`);

    const result = await postToFalQueue(model, {
        image_url: imageUrl,
        prompt: prompt || 'gentle animation with subtle movement',
        num_frames: duration * 24 // Approximate frames
    });

    if (result.video && result.video.url) {
        console.log(`[Fal AI Video] Generated: ${result.video.url}`);
        return result.video.url;
    }
    throw new Error('No video generated');
}

/**
 * Generate AI video from text (text-to-video)
 * @param {string} prompt - Video description
 * @param {number} duration - Video duration
 * @param {string} model - Model to use
 * @returns {Promise<string>} Generated video URL
 */
async function generateVideoFromText(prompt, duration = 5, model = 'fal-ai/ltxv-13b-098-distilled') {
    console.log(`[Fal AI Video] Text to video: ${prompt.substring(0, 50)}...`);

    const result = await postToFalQueue(model, {
        prompt,
        num_frames: duration * 24
    });

    if (result.video && result.video.url) {
        console.log(`[Fal AI Video] Generated: ${result.video.url}`);
        return result.video.url;
    }
    throw new Error('No video generated');
}

module.exports = {
    generateVideo,
    generateVideoFromText
};
