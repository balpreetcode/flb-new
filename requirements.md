# Workflow Node Form Requirements

This document defines the fields required for each node type in the workflow builder. Clicking a node will open a form with these fields.

---

## 1. Upload Files
| Field | Type | Description |
|-------|------|-------------|
| Source Type | Select | Local, URL, or Cloud Storage |
| Asset Type | Select | Image, Video, or Audio |
| Files | File Upload | The actual assets to be processed |

## 2. Text To Text
| Field | Type | Description |
|-------|------|-------------|
| Prompt | Textarea | Instruction or topic for text generation |
| Model | Select | OpenAI (GPT-4), Anthropic (Claude 3), etc. |
| System Message | Textarea | Initial behavior instruction for the AI |
| Temperature | Number (0-1) | Controls randomness (0 = deterministic, 1 = creative) |

## 3. Text To Image
| Field | Type | Description |
|-------|------|-------------|
| Positive Prompt | Textarea | Detailed description of what to generate |
| Negative Prompt | Textarea | What to exclude from the image |
| Aspect Ratio | Select | 1:1, 16:9, 9:16, 4:3 |
| Model | Select | DALL-E 3, Stable Diffusion XL, Fal AI (Flux) |

## 4. Text To Video
| Field | Type | Description |
|-------|------|-------------|
| Prompt | Textarea | Visual description of the video content |
| Duration | Select | 5 seconds, 10 seconds |
| Resolution | Select | 720p, 1080p, 4K |
| Style | Select | Realistic, Cinematic, Anime, 3D Render |

## 5. Text To Music
| Field | Type | Description |
|-------|------|-------------|
| Prompt | Textarea | Mood, genre, and instruments (e.g., "Lo-fi hip hop with rainy mood") |
| Duration | Number (sec) | Length of the generated track |
| Tempo | Number (BPM) | Beats per minute |

## 6. Text To Speech
| Field | Type | Description |
|-------|------|-------------|
| Text Content | Textarea | The text to be converted to speech |
| Voice | Select | Available voices (ElevenLabs, OpenAI) |
| Language | Select | English, Spanish, French, etc. |
| Stability | Slider (0-1) | Consistency of the voice tone |

## 7. Image To Video
| Field | Type | Description |
|-------|------|-------------|
| Source Image | Image Select | The image to animate |
| Motion Bucket | Number (1-255) | Intensity of motion (higher = more motion) |
| Duration | Select | 5 seconds, 10 seconds |
| Seed | Number | For reproducible results |

## 8. Image To Image
| Field | Type | Description |
|-------|------|-------------|
| Source Image | Image Select | The original image to modify |
| Prompt | Textarea | Instructions for modification |
| Strength | Slider (0-1) | How much to deviate from the original image |
| Model | Select | Stable Diffusion Img2Img, Fal AI |

## 9. Face Swap
| Field | Type | Description |
|-------|------|-------------|
| Target Image | Image Select | The image where the face will be placed |
| Source Face | Image Select | The image providing the new face |
| Face Enhance | Toggle | Whether to run a face restoration pass |

## 10. Lip Sync
| Field | Type | Description |
|-------|------|-------------|
| Video File | Video Select | The video of a person speaking (or static) |
| Audio File | Audio Select | The speech audio to sync with |
| Model | Select | SadTalker, HeyGen, SyncLabs |

## 11. AI Avatar
| Field | Type | Description |
|-------|------|-------------|
| Avatar | Select | Predefined digital humans or custom upload |
| Script | Textarea | What the avatar should say |
| Background | Select | Transparent (Green Screen), Solid Color, Image |

## 12. Enhancer
| Field | Type | Description |
|-------|------|-------------|
| Source File | Media Select | Image or Video to upscale/clean |
| Upscale Factor | Select | 1x (denoise only), 2x, 4x |
| Denoise Strength | Slider (0-1) | Amount of noise reduction to apply |

## 13. Split Text
| Field | Type | Description |
|-------|------|-------------|
| Source Text | Textarea | The large block of text to split |
| Split Method | Select | By Sentence, By Word Count, By Token Limit |
| Max Size | Number | Limit for each chunk (e.g., 500 tokens) |

## 14. Object Removal
| Field | Type | Description |
|-------|------|-------------|
| Source Image | Image Select | Image containing the object to remove |
| Mask/Description| Text/Image | Description of object OR drawn mask |

## 15. Remove Background
| Field | Type | Description |
|-------|------|-------------|
| Source Image | Image Select | Image to process |
| Output Format | Select | PNG (Transparent), JPG with specific color |

## 16. Sound Effects
| Field | Type | Description |
|-------|------|-------------|
| Prompt | Textarea | Description of the sound (e.g., "Sword clashing with metal") |
| Duration | Number (sec) | Length of the effect |
| Sync to Video | Video Select | Optional: Align sound start/end with video timestamps |

## 17. Edit Video
| Field | Type | Description |
|-------|------|-------------|
| Source Video | Video Select | Video to edit |
| Trim Start/End | Time Picker | Start and end stamps for clipping |
| Crop Ratio | Select | 1:1, 16:9, 9:16 |
| Filter | Select | Grayscale, Sepia, High Contrast, etc. |

## 18. Clip Merger
| Field | Type | Description |
|-------|------|-------------|
| Input Clips | List Selection| Sequential list of video/image clips |
| Transition | Select | Cross-fade, Slide, Cut, Zoom |
| BGM Overlay | Audio Select | Optional background music for the whole sequence |
