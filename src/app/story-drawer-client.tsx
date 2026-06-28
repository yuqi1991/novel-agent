"use client";

import { useActionState } from "react";
import {
  createStoryFromDraftAction,
  parseSillyTavernStoryDraftAction
} from "./actions";

type StoryListItem = {
  id: string;
  title: string;
  description: string;
};

type DraftState = Awaited<ReturnType<typeof parseSillyTavernStoryDraftAction>>;

const initialState: DraftState = {
  ok: false,
  error: "",
  draft: null
};

export function StoryLibraryDrawerClient({ stories }: { stories: StoryListItem[] }) {
  const [state, formAction] = useActionState(parseSillyTavernStoryDraftAction, initialState);
  const draft = state.draft;
  const title = draft?.title ?? "";
  const description = draft?.description ?? "";
  const importedAssetsJson = JSON.stringify(draft?.importedAssets ?? []);
  const characterProfilesJson = JSON.stringify(draft?.characterProfiles ?? []);
  const worldEntriesJson = JSON.stringify(draft?.worldEntries ?? []);

  return (
    <div className="drawer-stack">
      <section className="panel list-panel" aria-label="故事列表">
        <div className="panel-heading">
          <h2>故事库</h2>
          <span>{stories.length}</span>
        </div>
        {stories.length === 0 ? (
          <p className="empty">还没有故事。可以直接创建，或先粘贴 SillyTavern JSON 预填。</p>
        ) : (
          <ul className="story-list">
            {stories.map((story) => (
              <li key={story.id}>
                <a href={`/stories/${story.id}`}>
                  <strong>{story.title}</strong>
                  <span>{story.description || "暂无简介"}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={formAction} className="panel form-panel import-panel" aria-label="解析 SillyTavern JSON">
        <h2>导入预填</h2>
        <label>
          <span>导入类型</span>
          <select name="sourceType" defaultValue="character_card">
            <option value="character_card">角色卡 JSON</option>
            <option value="world_lorebook">世界书 JSON</option>
          </select>
        </label>
        <label>
          <span>文件名</span>
          <input name="originalFilename" placeholder="azura.json" />
        </label>
        <label>
          <span>SillyTavern JSON</span>
          <textarea name="jsonText" placeholder="粘贴角色卡或世界书 JSON" />
        </label>
        <button type="submit">解析并预填</button>
        {state.error ? <p className="form-error">{state.error}</p> : null}
      </form>

      <form action={createStoryFromDraftAction} className="panel form-panel" aria-label="创建故事">
        <h2>创建故事</h2>
        <input type="hidden" name="importedAssetsJson" value={importedAssetsJson} />
        <input type="hidden" name="characterProfilesJson" value={characterProfilesJson} />
        <input type="hidden" name="worldEntriesJson" value={worldEntriesJson} />
        <label>
          <span>标题</span>
          <input name="title" defaultValue={title} placeholder="魔法学院第一夜" required maxLength={120} />
        </label>
        <label>
          <span>简介</span>
          <textarea name="description" defaultValue={description} placeholder="故事背景或开场设定" />
        </label>
        {draft ? (
          <div className="draft-preview">
            <strong>已预填</strong>
            <span>{draft.characterProfiles.length} 个角色</span>
            <span>{draft.worldEntries.length} 条世界书</span>
          </div>
        ) : null}
        <button type="submit">创建并进入故事</button>
      </form>
    </div>
  );
}
