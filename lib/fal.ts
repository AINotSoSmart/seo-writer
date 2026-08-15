import { fal } from "@fal-ai/client";

export async function generateImage(prompt: string) {
  const result = await fal.subscribe("fal-ai/flux-2", {
    input: {
      prompt,
      guidance_scale: 10,
      num_inference_steps: 28,
      image_size: {
        width: 1200,
        height: 800
      },
      num_images: 1,
      acceleration: "regular",
      enable_safety_checker: true,
      output_format: "webp"
    },
    logs: true,
  });

  return result.data;
}
