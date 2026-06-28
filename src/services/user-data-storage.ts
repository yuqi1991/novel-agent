import fs from "node:fs";
import path from "node:path";

export function getUserDataRoot() {
  const configuredRoot = process.env.NOVEL_AGENT_USER_DATA_DIR;
  if (configuredRoot) {
    return path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.join(/*turbopackIgnore: true*/ process.cwd(), configuredRoot);
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "user_data");
}

export function storyDataPath(storyId: string) {
  return path.join(getUserDataRoot(), "stories", storyId);
}

export function sessionDataPath(storyId: string, sessionId: string) {
  return path.join(storyDataPath(storyId), "saves", sessionId);
}

export function progressWikiDataPath(storyId: string, sessionId: string) {
  return path.join(sessionDataPath(storyId, sessionId), "wiki");
}

export function ensureStoryDataDirectory(storyId: string) {
  const storyPath = storyDataPath(storyId);
  fs.mkdirSync(path.join(storyPath, "saves"), { recursive: true });
  return storyPath;
}

export function ensureSessionDataDirectory(input: { storyId: string; sessionId: string }) {
  const sessionPath = sessionDataPath(input.storyId, input.sessionId);
  fs.mkdirSync(progressWikiDataPath(input.storyId, input.sessionId), { recursive: true });
  return sessionPath;
}
