import { describe, expect, test } from "bun:test";
import { ChatClient, user } from "../src/chat.js";
import { VideoClient } from "../src/video.js";
import type { GenerateVideoRequest } from "../src/gen/xai/api/v1/video_pb.js";
import type { GetCompletionsRequest } from "../src/gen/xai/api/v1/chat_pb.js";

const video = new VideoClient({} as never);
const videoRequest = (options: Parameters<VideoClient["prepare"]>[2]) =>
  video.prepare("p", "grok-imagine-video-1.5", options).request.value as GenerateVideoRequest;

describe("video first/last frame and keyframes", () => {
  test("sets lastFrame from URL or file ID", () => {
    const byUrl = videoRequest({ imageUrl: "https://a/first.jpg", lastFrameUrl: "https://a/last.jpg" });
    expect(byUrl.image?.source).toEqual({ case: "imageUrl", value: "https://a/first.jpg" });
    expect(byUrl.lastFrame?.source).toEqual({ case: "imageUrl", value: "https://a/last.jpg" });
    expect(videoRequest({ lastFrameFileId: "file_1" }).lastFrame?.source).toEqual({ case: "fileId", value: "file_1" });
    expect(videoRequest({}).lastFrame).toBeUndefined();
  });

  test("rejects both lastFrameUrl and lastFrameFileId", () => {
    expect(() => videoRequest({ lastFrameUrl: "u", lastFrameFileId: "f" })).toThrow("Only one of lastFrameUrl");
  });

  test("maps keyframes in order", () => {
    const req = videoRequest({
      keyframes: [
        { imageUrl: "https://a/clay.jpg", timestamp: 3 },
        { imageFileId: "file_2", timestamp: 6.5 },
      ],
    });
    expect(req.keyframes.map((k) => [k.image?.source, k.timestampS])).toEqual([
      [{ case: "imageUrl", value: "https://a/clay.jpg" }, 3],
      [{ case: "fileId", value: "file_2" }, 6.5],
    ]);
  });

  test("rejects malformed keyframes", () => {
    const bad = (k: unknown) => () => videoRequest({ keyframes: [k as never] });
    expect(bad({ imageUrl: "u", imageFileId: "f", timestamp: 1 })).toThrow("exactly one");
    expect(bad({ timestamp: 1 })).toThrow("exactly one");
    expect(bad({ imageUrl: "", timestamp: 1 })).toThrow("exactly one");
    expect(bad({ imageUrl: "u" })).toThrow("timestamp");
    expect(bad({ imageUrl: "u", timestamp: 1, extra: true })).toThrow("Unknown keyframe keys: extra");
  });
});

describe("chat safetyIdentifier", () => {
  const chatRequest = (opts: { safetyIdentifier?: string }) =>
    new ChatClient({} as never).create({ model: "grok-4", messages: [user("hi")], ...opts }).prepare().request
      .value as GetCompletionsRequest;

  test("is sent when set and omitted otherwise", () => {
    expect(chatRequest({ safetyIdentifier: "user_hash" }).safetyIdentifier).toBe("user_hash");
    expect(chatRequest({}).safetyIdentifier).toBeUndefined();
  });
});
