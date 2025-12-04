import { fal } from "@fal-ai/client";

export async function generateImage(prompt: string) {
  const result = await fal.subscribe("fal-ai/z-image/turbo", {
    input: {
      prompt,
      image_size: {
        width: 1200,
        height: 800
      },
      num_inference_steps: 8,
      num_images: 1,
      enable_safety_checker: true,
      output_format: "png",
      acceleration: "none"
    },
    logs: true,
  });

  return result.data;
}
