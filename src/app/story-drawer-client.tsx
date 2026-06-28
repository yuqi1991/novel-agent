"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createStoryFromDraftAction,
  parseSillyTavernStoryDraftAction
} from "./actions";

type StoryListItem = {
  id: string;
  title: string;
  description: string;
  latestSessionId?: string | null;
};

type DrawerMode = "library" | "new" | "import";
type DraftState = Awaited<ReturnType<typeof parseSillyTavernStoryDraftAction>>;

const initialState: DraftState = {
  ok: false,
  error: "",
  draft: null
};

export function StoryLibraryDrawerClient({ stories }: { stories: StoryListItem[] }) {
  const [mode, setMode] = useState<DrawerMode>(stories.length === 0 ? "new" : "library");
  const [state, formAction] = useActionState(parseSillyTavernStoryDraftAction, initialState);
  const draft = state.draft;

  useEffect(() => {
    if (draft) {
      setMode("new");
    }
  }, [draft]);

  return (
    <div className="drawer-stack story-library-drawer">
      <div className="drawer-toolstrip" aria-label="故事库工具">
        <button
          type="button"
          className={mode === "library" ? "tool-button active" : "tool-button"}
          onClick={() => setMode("library")}
          aria-label="显示故事列表"
          title="故事列表"
        >
          库
        </button>
        <button
          type="button"
          className={mode === "new" ? "tool-button active" : "tool-button"}
          onClick={() => setMode("new")}
          aria-label="新建故事"
          title="新建故事"
        >
          +
        </button>
        <button
          type="button"
          className={mode === "import" ? "tool-button active" : "tool-button"}
          onClick={() => setMode("import")}
          aria-label="导入 SillyTavern"
          title="导入 SillyTavern"
        >
          ST
        </button>
      </div>

      {mode === "library" ? <StoryListPanel stories={stories} /> : null}

      {mode === "import" ? (
        <form action={formAction} className="panel form-panel import-panel" aria-label="解析 SillyTavern JSON">
          <div className="panel-heading">
            <h2>导入 SillyTavern</h2>
            <span>ST</span>
          </div>
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
      ) : null}

      {mode === "new" ? <StoryDraftEditor draft={draft} /> : null}
    </div>
  );
}

function StoryListPanel({ stories }: { stories: StoryListItem[] }) {
  return (
    <section className="panel list-panel" aria-label="故事列表">
      <div className="panel-heading">
        <h2>全部故事</h2>
        <span>{stories.length}</span>
      </div>
      {stories.length === 0 ? (
        <p className="empty">还没有故事。点击 + 新建，或用 ST 导入预填。</p>
      ) : (
        <ul className="story-list">
          {stories.map((story) => {
            const params = new URLSearchParams({ panel: "worldBook" });
            if (story.latestSessionId) {
              params.set("sessionId", story.latestSessionId);
            }
            return (
              <li key={story.id}>
                <a href={`/stories/${story.id}?${params.toString()}`}>
                  <strong>{story.title}</strong>
                  <span>{story.description || "暂无简介"}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StoryDraftEditor({ draft }: { draft: DraftState["draft"] }) {
  const title = draft?.title ?? "";
  const description = draft?.description ?? "";
  const importedAssetsJson = JSON.stringify(draft?.importedAssets ?? []);
  const characterProfilesJson = JSON.stringify(draft?.characterProfiles ?? []);
  const worldEntriesJson = JSON.stringify(draft?.worldEntries ?? []);
  const firstCharacter = draft?.characterProfiles[0] ?? null;
  const firstWorldEntry = draft?.worldEntries[0] ?? null;

  return (
    <form action={createStoryFromDraftAction} className="story-card-editor" aria-label="创建故事">
      <input type="hidden" name="importedAssetsJson" value={importedAssetsJson} />
      <input type="hidden" name="characterProfilesJson" value={characterProfilesJson} />
      <input type="hidden" name="worldEntriesJson" value={worldEntriesJson} />

      <section className="panel st-profile-panel">
        <div className="st-profile-top">
          <div className="st-avatar" aria-hidden="true">
            {title.trim().slice(0, 1) || "新"}
          </div>
          <div className="st-profile-fields">
            <label>
              <span>故事 / 角色名</span>
              <input name="title" defaultValue={title} placeholder="魔法学院第一夜" required maxLength={120} />
            </label>
            <label>
              <span>故事简介</span>
              <textarea name="description" defaultValue={description} placeholder="故事背景或开场设定" />
            </label>
          </div>
        </div>
        <div className="tag-row">
          <span className="tag strong">{draft ? "导入预填" : "新故事"}</span>
          <span className="tag">{draft?.characterProfiles.length ?? 0} 角色</span>
          <span className="tag">{draft?.worldEntries.length ?? 0} 世界书</span>
        </div>
      </section>

      <section className="panel st-tools-panel" aria-label="故事资料工具">
        <div className="drawer-toolstrip compact">
          <span className="tool-button passive">人设</span>
          <span className="tool-button passive">世界</span>
          <span className="tool-button passive">首条</span>
          <span className="tool-button passive">标签</span>
        </div>
      </section>

      <section className="panel form-panel">
        <h3>作者注释 / 角色描述</h3>
        <label>
          <span>角色描述</span>
          <textarea
            readOnly
            value={firstCharacter?.profileText ?? ""}
            placeholder="保存后可在故事资料中继续编辑角色描述。"
          />
        </label>
        <label>
          <span>世界资料预览</span>
          <textarea
            readOnly
            value={firstWorldEntry ? `${firstWorldEntry.title}\n${firstWorldEntry.body}` : ""}
            placeholder="导入世界书后会在这里预览第一条资料。"
          />
        </label>
      </section>

      <section className="panel form-panel">
        <h3>第一条消息</h3>
        <textarea
          readOnly
          value=""
          placeholder="当前 MVP 保存故事资料后进入新存档聊天，第一条消息在聊天窗口发送。"
        />
      </section>

      <button type="submit">保存创建并进入故事</button>
    </form>
  );
}
