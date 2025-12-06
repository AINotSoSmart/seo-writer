import { NextRequest, NextResponse } from "next/server";
import { getR2ObjectStream } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * Proxy route to serve images from R2 storage.
 * Usage: /api/images/featured-images/article-id/image.png
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ key: string[] }> }
) {
    try {
        const { key: keyParts } = await params;

        // Reconstruct the key from path segments
        const key = keyParts.join("/");

        // Basic validation to prevent path traversal
        if (key.includes("..") || key.startsWith("/")) {
            return NextResponse.json({ error: "Invalid key" }, { status: 400 });
        }

        // Only allow specific prefixes for security
        const allowedPrefixes = ["featured-images/"];
        const isAllowed = allowedPrefixes.some(prefix => key.startsWith(prefix));
        if (!isAllowed) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Fetch from R2
        const { body, contentType, contentLength, lastModified } = await getR2ObjectStream(key);

        if (!body) {
            return NextResponse.json({ error: "Image not found" }, { status: 404 });
        }

        // Build response headers
        const headers: HeadersInit = {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
        };

        if (contentLength) {
            headers["Content-Length"] = String(contentLength);
        }

        if (lastModified) {
            headers["Last-Modified"] = lastModified;
        }

        // Stream the response
        // Handle both Node.js Readable and Web ReadableStream
        if (body.transformToWebStream) {
            // AWS SDK v3 returns a stream with transformToWebStream method
            return new NextResponse(body.transformToWebStream(), { headers });
        } else if (body instanceof ReadableStream) {
            return new NextResponse(body, { headers });
        } else {
            // Node.js Readable stream - convert to web stream
            const webStream = new ReadableStream({
                start(controller) {
                    body.on("data", (chunk: Buffer) => controller.enqueue(chunk));
                    body.on("end", () => controller.close());
                    body.on("error", (err: Error) => controller.error(err));
                },
            });
            return new NextResponse(webStream, { headers });
        }
    } catch (error: any) {
        console.error("R2 Image Proxy Error:", error);

        // Check for specific R2/S3 errors
        if (error.name === "NoSuchKey" || error.Code === "NoSuchKey") {
            return NextResponse.json({ error: "Image not found" }, { status: 404 });
        }

        return NextResponse.json(
            { error: "Failed to fetch image" },
            { status: 500 }
        );
    }
}
