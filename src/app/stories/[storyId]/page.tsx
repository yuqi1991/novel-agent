import Link from "next/link";
import { notFound } from "next/navigation";
import { updateStoryAction } from "@/app/actions";
import { createExternalToolConfigurationAction } from "@/app/agent-capability-actions";
import {
  createAgentProfileAction,
  deleteAgentProfileAction,
  updateAgentProfileAction
} from "@/app/agent-profile-actions";
import {
  importSillyTavernCharacterAction,
  importSillyTavernWorldAction
} from "@/app/import-actions";
import {
  createAgentAssignmentAction,
  createAgentAssignmentFromProfileAction,
  createOrchestrationConfigurationAction,
  deleteAgentAssignmentAction,
  deleteOrchestrationConfigurationAction
} from "@/app/orchestration-actions";
import {
  createPlaySessionAction,
  forkPlaySessionAction,
  rerollLatestReplyVariantAction,
  selectReplyVariantAction,
  submitPlayerMessageAction
} from "@/app/play-actions";
import {
  createProgressWikiDocumentAction,
  createWikiSnapshotAction,
  deleteProgressWikiDocumentAction,
  updateProgressWikiDocumentAction
} from "@/app/progress-wiki-actions";
import { StoryLibraryDrawerClient } from "@/app/story-drawer-client";
import {
  createCharacterProfileAction,
  createWorldEntryAction,
  deleteCharacterProfileAction,
  deleteWorldEntryAction,
  setPlayerCharacterAction,
  updateCharacterProfileAction,
  updateWorldEntryAction
} from "@/app/story-material-actions";
import { listExternalToolConfigurations } from "@/services/agent-capability-service";
import { listAgentProfiles } from "@/services/agent-profile-service";
import { listOrchestrationConfigurations } from "@/services/orchestration-config-service";
import { listProgressWiki } from "@/services/progress-wiki-service";
import {
  ensureDefaultPlaySession,
  getSessionTranscript,
  listPlaySessions
} from "@/services/session-service";
import { listStoryMaterial } from "@/services/story-material-service";
import { getStory, listStories } from "@/services/story-service";
import { listWorkflowTracesForSession } from "@/services/trace-service";

type StoryMaterial = Awaited<ReturnType<typeof listStoryMaterial>>;
type CharacterProfile = StoryMaterial["characterProfiles"][number];
type WorldEntry = StoryMaterial["worldEntries"][number];
type PanelKey = "storyLibrary" | "worldBook" | "agentProfiles" | "orchestration" | "saves" | "traces";
type UnknownRecord = Record<string, unknown>;

const roleLabels = {
  player: "玩家角色",
  non_player: "NPC",
  unspecified: "未指定"
};

const inclusionModeLabels = {
  always: "始终加入",
  triggered: "关键词触发",
  semantic: "语义检索",
  disabled: "禁用"
};

const panelLabels: Record<PanelKey, string> = {
  storyLibrary: "故事库",
  worldBook: "故事资料 / 世界书",
  agentProfiles: "Agent 管理",
  orchestration: "Agent 编排",
  saves: "存档管理",
  traces: "运行记录"
};

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getSessionId(session: unknown) {
  const record = asRecord(session);
  return record ? readString(record.id) : "";
}

function getSessionTitle(session: unknown) {
  const record = asRecord(session);
  return record ? readString(record.title, "未命名存档") : "未命名存档";
}

function getSessionDate(session: unknown) {
  const record = asRecord(session);
  return record ? readString(record.updatedAt) || readString(record.createdAt) : "";
}

function getTranscriptItems(transcript: unknown) {
  if (Array.isArray(transcript)) {
    return transcript;
  }
  const record = asRecord(transcript);
  if (!record) {
    return [];
  }
  for (const key of ["items", "entries", "messages", "positions"]) {
    const items = record[key];
    if (Array.isArray(items)) {
      return items;
    }
  }
  return [];
}

function getTranscriptKind(item: unknown) {
  const record = asRecord(item);
  const kind = record ? readString(record.kind) || readString(record.type) || readString(record.role) : "";
  if (kind === "player_message" || kind === "player" || kind === "user") {
    return "玩家";
  }
  if (kind === "system_response" || kind === "narrative_response" || kind === "assistant") {
    return "叙事";
  }
  return kind || "记录";
}

function getTranscriptText(item: unknown) {
  const record = asRecord(item);
  if (!record) {
    return "";
  }
  return (
    readString(record.messageText) ||
    readString(record.narrativeResponseText) ||
    readString(record.text) ||
    readString(record.content) ||
    readString(record.body)
  );
}

function isSystemTranscriptItem(item: unknown) {
  const record = asRecord(item);
  const kind = record ? readString(record.kind) || readString(record.type) || readString(record.role) : "";
  return kind === "system_response" || kind === "narrative_response" || kind === "assistant";
}

function getLatestSystemPosition(transcriptItems: unknown[]) {
  return transcriptItems.filter(isSystemTranscriptItem).at(-1) ?? null;
}

function getPositionId(item: unknown) {
  const record = asRecord(item);
  return record ? readString(record.positionId) || readString(record.id) : "";
}

function getSelectedVariantId(item: unknown) {
  const record = asRecord(item);
  return record ? readString(record.selectedVariantId) : "";
}

function getReplyVariants(item: unknown) {
  const record = asRecord(item);
  return record ? readArray(record.variants).map(asRecord).filter((variant): variant is UnknownRecord => Boolean(variant)) : [];
}

function getVariantId(variant: UnknownRecord) {
  return readString(variant.id);
}

function getVariantIndex(variant: UnknownRecord) {
  return typeof variant.variantIndex === "number" ? variant.variantIndex : 0;
}

function getSelectedVariantIndex(variants: UnknownRecord[], selectedVariantId: string) {
  const selectedVariant = variants.find((variant) => getVariantId(variant) === selectedVariantId) ?? variants[0];
  return selectedVariant ? getVariantIndex(selectedVariant) : 0;
}

function getPanel(value: string | string[] | undefined): PanelKey | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && candidate in panelLabels ? (candidate as PanelKey) : null;
}

function panelHref(storyId: string, panel: PanelKey, sessionId: string) {
  const params = new URLSearchParams({ panel });
  if (sessionId) {
    params.set("sessionId", sessionId);
  }
  return `/stories/${storyId}?${params.toString()}`;
}

function storyQueryHref(
  storyId: string,
  values: { sessionId?: string; panel?: PanelKey; wikiDoc?: string } = {}
) {
  const params = new URLSearchParams();
  if (values.sessionId) {
    params.set("sessionId", values.sessionId);
  }
  if (values.panel) {
    params.set("panel", values.panel);
  }
  if (values.wikiDoc) {
    params.set("wikiDoc", values.wikiDoc);
  }
  const query = params.toString();
  return query ? `/stories/${storyId}?${query}` : `/stories/${storyId}`;
}

export default async function StoryChatPage({
  params,
  searchParams
}: {
  params: Promise<{ storyId: string }>;
  searchParams?: Promise<{ sessionId?: string | string[]; panel?: string | string[]; wikiDoc?: string | string[] }>;
}) {
  const { storyId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const querySessionId = Array.isArray(resolvedSearchParams.sessionId)
    ? resolvedSearchParams.sessionId[0]
    : resolvedSearchParams.sessionId;
  const activeWikiDocumentId = Array.isArray(resolvedSearchParams.wikiDoc)
    ? resolvedSearchParams.wikiDoc[0]
    : resolvedSearchParams.wikiDoc;
  const activePanel = getPanel(resolvedSearchParams.panel);
  const story = await getStory(storyId);

  if (!story) {
    notFound();
  }

  const defaultSession = await ensureDefaultPlaySession(storyId);
  const [material, rawPlaySessions, stories, agentProfiles, orchestrationConfigurations, externalToolConfigurations] =
    await Promise.all([
      listStoryMaterial(storyId),
      listPlaySessions(storyId),
      listStories(),
      listAgentProfiles(),
      listOrchestrationConfigurations(),
      listExternalToolConfigurations()
    ]);
  const storySessionLists = await Promise.all(stories.map((libraryStory) => listPlaySessions(libraryStory.id)));
  const playSessions = readArray(rawPlaySessions);
  const activeSession =
    playSessions.find((session) => getSessionId(session) === querySessionId) ??
    playSessions.find((session) => getSessionId(session) === defaultSession.id) ??
    defaultSession;
  const activeSessionId = getSessionId(activeSession);
  const [transcript, workflowTraces, progressWiki] = await Promise.all([
    getSessionTranscript({ storyId, sessionId: activeSessionId }),
    listWorkflowTracesForSession(activeSessionId),
    listProgressWiki(activeSessionId)
  ]);

  const characterProfiles: CharacterProfile[] = material.characterProfiles;
  const worldEntries: WorldEntry[] = material.worldEntries;
  const transcriptItems = getTranscriptItems(transcript);
  const latestSystemPosition = getLatestSystemPosition(transcriptItems);
  const latestSystemPositionId = getPositionId(latestSystemPosition);
  const selectedVariantId = getSelectedVariantId(latestSystemPosition);
  const latestReplyVariants = getReplyVariants(latestSystemPosition);
  const selectedVariantIndex = getSelectedVariantIndex(latestReplyVariants, selectedVariantId);
  const playerCharacterProfileId = material.playerCharacterProfileId ?? null;
  const playerCharacter = characterProfiles.find((profile) => profile.id === playerCharacterProfileId) ?? null;
  const storiesWithSessions = stories.map((libraryStory, index) => ({
    ...libraryStory,
    latestSessionId:
      libraryStory.id === storyId
        ? playSessions.at(-1)
          ? getSessionId(playSessions.at(-1))
          : activeSessionId
        : storySessionLists[index]?.at(-1)?.id ?? null
  }));

  return (
    <main className="chat-shell">
      <header className="app-topbar">
        <Link href={`/stories/${storyId}`} className="brand-link">
          Novel Agent
        </Link>
        <div className="story-title-block">
          <strong>{story.title}</strong>
          <span>{getSessionTitle(activeSession)}</span>
        </div>
        <nav className="topbar-actions" aria-label="主导航">
          {(Object.keys(panelLabels) as PanelKey[]).map((panel) => (
            <Link
              key={panel}
              href={panelHref(storyId, panel, activeSessionId)}
              className={activePanel === panel ? "topbar-button active" : "topbar-button"}
            >
              {panelLabels[panel]}
            </Link>
          ))}
        </nav>
      </header>

      <section className={activePanel ? "chat-layout drawer-open" : "chat-layout"}>
        <section className="chat-window" aria-label="聊天窗口">
          <div className="chat-header">
            <div>
              <p className="eyebrow">当前故事</p>
              <h1>{story.title}</h1>
            </div>
            <div className="current-session-card" aria-label="当前存档">
              <span>当前存档</span>
              <strong>{getSessionTitle(activeSession)}</strong>
              <Link href={panelHref(storyId, "saves", activeSessionId)}>管理存档</Link>
            </div>
          </div>

          <ol className="chat-transcript">
            {transcriptItems.length === 0 ? (
              <li className="empty-chat">还没有聊天记录。输入一句话开始游玩。</li>
            ) : (
              transcriptItems.map((item, index) => {
                const isSystem = isSystemTranscriptItem(item);
                return (
                  <li key={`${getTranscriptKind(item)}-${index}`} className={isSystem ? "chat-message system" : "chat-message player"}>
                    <div className="message-meta">
                      <span>{getTranscriptKind(item)}</span>
                      <form action={forkPlaySessionAction}>
                        <input type="hidden" name="storyId" value={storyId} />
                        <input type="hidden" name="sourceSessionId" value={activeSessionId} />
                        <input type="hidden" name="forkPositionId" value={getPositionId(item)} />
                        <input type="hidden" name="replyVariantId" value={getSelectedVariantId(item)} />
                        <input type="hidden" name="title" value={`从第 ${index + 1} 楼分叉`} />
                        <button className="ghost-button" type="submit">分叉</button>
                      </form>
                    </div>
                    <p>{getTranscriptText(item) || "没有文本。"}</p>
                  </li>
                );
              })
            )}
          </ol>

          {latestSystemPositionId ? (
            <div className="reply-toolbar" aria-label="回复变体">
              <span>回复 {selectedVariantIndex + 1} / {Math.max(latestReplyVariants.length, 1)}</span>
              <form action={rerollLatestReplyVariantAction}>
                <input type="hidden" name="storyId" value={storyId} />
                <input type="hidden" name="sessionId" value={activeSessionId} />
                <button className="secondary" type="submit">重掷回复</button>
              </form>
              {latestReplyVariants.map((variant) => {
                const variantId = getVariantId(variant);
                const variantIndex = getVariantIndex(variant);
                return (
                  <form key={variantId || variantIndex} action={selectReplyVariantAction}>
                    <input type="hidden" name="storyId" value={storyId} />
                    <input type="hidden" name="sessionId" value={activeSessionId} />
                    <input type="hidden" name="conversationPositionId" value={latestSystemPositionId} />
                    <input type="hidden" name="replyVariantId" value={variantId} />
                    <button
                      type="submit"
                      className={variantId === selectedVariantId ? "secondary active-variant" : "secondary"}
                    >
                      {variantIndex + 1}
                    </button>
                  </form>
                );
              })}
            </div>
          ) : null}

          <form action={submitPlayerMessageAction} className="chat-composer">
            <input type="hidden" name="storyId" value={storyId} />
            <input type="hidden" name="sessionId" value={activeSessionId} />
            <textarea name="messageText" placeholder="输入玩家角色的对白或行动..." required maxLength={8000} />
            <button type="submit">发送</button>
          </form>
        </section>

        {activePanel ? (
          <aside className="side-drawer" aria-label={panelLabels[activePanel]}>
            <div className="drawer-header">
              <h2>{panelLabels[activePanel]}</h2>
              <Link href={`/stories/${storyId}?sessionId=${encodeURIComponent(activeSessionId)}`}>关闭</Link>
            </div>
            {activePanel === "storyLibrary" ? (
              <StoryLibraryDrawerClient stories={storiesWithSessions} />
            ) : null}
            {activePanel === "worldBook" ? (
              <WorldBookPanel
                storyId={storyId}
                storyTitle={story.title}
                storyDescription={story.description}
                characterProfiles={characterProfiles}
                worldEntries={worldEntries}
                playerCharacterProfileId={playerCharacterProfileId}
                playerCharacterName={playerCharacter?.name ?? ""}
              />
            ) : null}
            {activePanel === "agentProfiles" ? (
              <AgentProfilesPanel storyId={storyId} agentProfiles={agentProfiles} />
            ) : null}
            {activePanel === "orchestration" ? (
              <OrchestrationPanel
                storyId={storyId}
                agentProfiles={agentProfiles}
                configurations={orchestrationConfigurations}
                externalTools={externalToolConfigurations}
              />
            ) : null}
            {activePanel === "saves" ? (
              <SaveManagerPanel
                storyId={storyId}
                activeSessionId={activeSessionId}
                activeSessionTitle={getSessionTitle(activeSession)}
                activeWikiDocumentId={activeWikiDocumentId}
                playSessions={playSessions}
                transcriptItems={transcriptItems}
                progressWiki={progressWiki}
              />
            ) : null}
            {activePanel === "traces" ? (
              <TracePanel activeSessionTitle={getSessionTitle(activeSession)} workflowTraces={workflowTraces} />
            ) : null}
          </aside>
        ) : null}
      </section>
    </main>
  );
}

function WorldBookPanel({
  storyId,
  storyTitle,
  storyDescription,
  characterProfiles,
  worldEntries,
  playerCharacterProfileId,
  playerCharacterName
}: {
  storyId: string;
  storyTitle: string;
  storyDescription: string;
  characterProfiles: CharacterProfile[];
  worldEntries: WorldEntry[];
  playerCharacterProfileId: string | null;
  playerCharacterName: string;
}) {
  const primaryCharacter = characterProfiles[0] ?? null;
  const openingEntry = worldEntries[0] ?? null;

  return (
    <div className="drawer-stack story-card-editor">
      <form action={updateStoryAction} className="panel st-profile-panel" aria-label="故事资料">
        <input type="hidden" name="storyId" value={storyId} />
        <div className="st-profile-top">
          <div className="st-avatar" aria-hidden="true">{storyTitle.slice(0, 1)}</div>
          <div className="st-profile-fields">
            <label><span>故事 / 角色名</span><input name="title" defaultValue={storyTitle} required maxLength={120} /></label>
            <label><span>故事简介</span><textarea name="description" defaultValue={storyDescription} /></label>
          </div>
        </div>
        <div className="tag-row">
          <span className="tag strong">{playerCharacterName || "未设置玩家角色"}</span>
          <span className="tag">{characterProfiles.length} 角色</span>
          <span className="tag">{worldEntries.length} 世界书</span>
        </div>
        <button type="submit">保存故事资料</button>
      </form>

      <section className="panel st-tools-panel" aria-label="资料工具">
        <div className="drawer-toolstrip compact">
          <span className="tool-button passive">人设</span>
          <span className="tool-button passive">世界</span>
          <span className="tool-button passive">首条</span>
          <span className="tool-button passive">标签</span>
        </div>
      </section>

      <form action={importSillyTavernCharacterAction} className="panel form-panel import-panel">
        <input type="hidden" name="storyId" value={storyId} />
        <h3>导入角色卡</h3>
        <label><span>文件名</span><input name="filename" placeholder="character-card.json" /></label>
        <label><span>角色卡 JSON</span><textarea name="payload" required /></label>
        <button type="submit">导入角色</button>
      </form>
      <form action={importSillyTavernWorldAction} className="panel form-panel import-panel">
        <input type="hidden" name="storyId" value={storyId} />
        <h3>导入世界书</h3>
        <label><span>文件名</span><input name="filename" placeholder="world-book.json" /></label>
        <label><span>世界书 JSON</span><textarea name="payload" required /></label>
        <button type="submit">导入世界书</button>
      </form>

      <form action={createCharacterProfileAction} className="panel form-panel">
        <input type="hidden" name="storyId" value={storyId} />
        <h3>创建角色</h3>
        <label><span>名称</span><input name="name" required maxLength={120} /></label>
        <label>
          <span>类型</span>
          <select name="role" defaultValue="unspecified">
            <option value="unspecified">未指定</option>
            <option value="player">玩家角色</option>
            <option value="non_player">NPC</option>
          </select>
        </label>
        <label><span>人设</span><textarea name="profileText" /></label>
        <button type="submit">创建角色</button>
      </form>

      <section className="panel form-panel" aria-label="作者注释和角色描述">
        <h3>作者注释 / 角色描述</h3>
        {primaryCharacter ? (
          <form action={updateCharacterProfileAction} className="wiki-document-form">
            <input type="hidden" name="storyId" value={storyId} />
            <input type="hidden" name="characterProfileId" value={primaryCharacter.id} />
            <label><span>名称</span><input name="name" defaultValue={primaryCharacter.name} required maxLength={120} /></label>
            <label>
              <span>类型</span>
              <select name="role" defaultValue={primaryCharacter.role}>
                <option value="unspecified">未指定</option>
                <option value="player">玩家角色</option>
                <option value="non_player">NPC</option>
              </select>
            </label>
            <label><span>角色描述</span><textarea name="profileText" defaultValue={primaryCharacter.profileText} /></label>
            <button type="submit">保存角色描述</button>
          </form>
        ) : (
          <p className="empty">还没有角色。创建或导入角色卡后，这里会显示主要角色描述。</p>
        )}
      </section>

      <section className="panel form-panel" aria-label="第一条消息">
        <h3>第一条消息</h3>
        <textarea readOnly value="" placeholder="第一条消息当前在聊天窗口发送；后续可扩展为故事开场白字段。" />
      </section>

      <section className="panel list-panel" aria-label="角色列表">
        <div className="panel-heading"><h3>角色</h3><span>{characterProfiles.length}</span></div>
        <ul className="material-list">
          {characterProfiles.map((profile) => {
            const isPlayer = profile.id === playerCharacterProfileId;
            return (
              <li key={profile.id} className="material-item">
                <div className="material-item-header">
                  <div><h3>{profile.name}</h3><div className="tag-row"><span className="tag">{roleLabels[profile.role as keyof typeof roleLabels]}</span>{isPlayer ? <span className="tag strong">玩家角色</span> : null}</div></div>
                  <form action={deleteCharacterProfileAction}>
                    <input type="hidden" name="storyId" value={storyId} />
                    <input type="hidden" name="characterProfileId" value={profile.id} />
                    <button className="secondary danger" type="submit">删除</button>
                  </form>
                </div>
                <p>{profile.profileText || "暂无人设。"}</p>
                <form action={setPlayerCharacterAction} className="inline-actions">
                  <input type="hidden" name="storyId" value={storyId} />
                  <input type="hidden" name="playerCharacterProfileId" value={isPlayer ? "" : profile.id} />
                  <button className="secondary" type="submit">{isPlayer ? "取消玩家角色" : "设为玩家角色"}</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
      <form action={createWorldEntryAction} className="panel form-panel">
        <input type="hidden" name="storyId" value={storyId} />
        <h3>创建世界书条目</h3>
        <label><span>标题</span><input name="title" required maxLength={160} /></label>
        <label>
          <span>加入方式</span>
          <select name="inclusionMode" defaultValue="semantic">
            <option value="semantic">语义检索</option>
            <option value="always">始终加入</option>
            <option value="triggered">关键词触发</option>
            <option value="disabled">禁用</option>
          </select>
        </label>
        <label><span>内容</span><textarea name="body" /></label>
        <button type="submit">创建条目</button>
      </form>

      {openingEntry ? (
        <section className="panel form-panel" aria-label="世界资料编辑">
          <h3>世界资料</h3>
          <form action={updateWorldEntryAction} className="wiki-document-form">
            <input type="hidden" name="storyId" value={storyId} />
            <input type="hidden" name="worldEntryId" value={openingEntry.id} />
            <label><span>标题</span><input name="title" defaultValue={openingEntry.title} required maxLength={160} /></label>
            <label>
              <span>加入方式</span>
              <select name="inclusionMode" defaultValue={openingEntry.inclusionMode}>
                <option value="semantic">语义检索</option>
                <option value="always">始终加入</option>
                <option value="triggered">关键词触发</option>
                <option value="disabled">禁用</option>
              </select>
            </label>
            <label><span>内容</span><textarea name="body" defaultValue={openingEntry.body} /></label>
            <button type="submit">保存世界资料</button>
          </form>
        </section>
      ) : null}

      <section className="panel list-panel" aria-label="世界书条目">
        <div className="panel-heading"><h3>世界书</h3><span>{worldEntries.length}</span></div>
        <ul className="material-list">
          {worldEntries.map((entry) => (
            <li key={entry.id} className="material-item">
              <div className="material-item-header">
                <div><h3>{entry.title}</h3><div className="tag-row"><span className="tag">{inclusionModeLabels[entry.inclusionMode as keyof typeof inclusionModeLabels]}</span></div></div>
                <form action={deleteWorldEntryAction}>
                  <input type="hidden" name="storyId" value={storyId} />
                  <input type="hidden" name="worldEntryId" value={entry.id} />
                  <button className="secondary danger" type="submit">删除</button>
                </form>
              </div>
              <p>{entry.body || "暂无内容。"}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AgentProfilesPanel({ storyId, agentProfiles }: { storyId: string; agentProfiles: Awaited<ReturnType<typeof listAgentProfiles>> }) {
  return (
    <div className="drawer-stack">
      <form action={createAgentProfileAction} className="panel form-panel">
        <input type="hidden" name="storyId" value={storyId} />
        <h3>创建 Agent Profile</h3>
        <div className="form-row two">
          <label><span>名称</span><input name="name" required /></label>
          <label><span>角色</span><input name="agentRole" required placeholder="plot_director" /></label>
        </div>
        <label><span>说明</span><textarea name="description" /></label>
        <label><span>指令</span><textarea name="instructions" /></label>
        <div className="form-row two">
          <label><span>Skill Set JSON</span><textarea name="skillSetJson" defaultValue="[]" /></label>
          <label><span>允许工具 JSON</span><textarea name="allowedToolsJson" defaultValue="[]" /></label>
        </div>
        <label><span>模型覆盖 JSON</span><textarea name="modelOverrideJson" /></label>
        <label><span>超时 ms</span><input name="timeoutMs" type="number" defaultValue="60000" /></label>
        <button type="submit">创建 Agent</button>
      </form>
      <section className="panel list-panel" aria-label="Agent Profiles">
        <div className="panel-heading"><h3>Agent Profiles</h3><span>{agentProfiles.length}</span></div>
        <ul className="material-list">
          {agentProfiles.map((profile) => (
            <li key={profile.id} className="material-item">
              <form action={updateAgentProfileAction} className="wiki-document-form">
                <input type="hidden" name="storyId" value={storyId} />
                <input type="hidden" name="profileId" value={profile.id} />
                <div className="form-row two">
                  <label><span>名称</span><input name="name" defaultValue={profile.name} required /></label>
                  <label><span>角色</span><input name="agentRole" defaultValue={profile.agentRole} required /></label>
                </div>
                <label><span>说明</span><textarea name="description" defaultValue={profile.description} /></label>
                <label><span>指令</span><textarea name="instructions" defaultValue={profile.instructions} /></label>
                <div className="form-row two">
                  <label><span>Skill Set JSON</span><textarea name="skillSetJson" defaultValue={profile.skillSetJson} /></label>
                  <label><span>允许工具 JSON</span><textarea name="allowedToolsJson" defaultValue={profile.allowedToolsJson} /></label>
                </div>
                <label><span>模型覆盖 JSON</span><textarea name="modelOverrideJson" defaultValue={profile.modelOverrideJson ?? ""} /></label>
                <label><span>超时 ms</span><input name="timeoutMs" type="number" defaultValue={profile.timeoutMs} /></label>
                <button type="submit">保存 Agent</button>
              </form>
              <form action={deleteAgentProfileAction}>
                <input type="hidden" name="storyId" value={storyId} />
                <input type="hidden" name="profileId" value={profile.id} />
                <button className="secondary danger" type="submit">删除 Agent</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function OrchestrationPanel({
  storyId,
  agentProfiles,
  configurations,
  externalTools
}: {
  storyId: string;
  agentProfiles: Awaited<ReturnType<typeof listAgentProfiles>>;
  configurations: Awaited<ReturnType<typeof listOrchestrationConfigurations>>;
  externalTools: Awaited<ReturnType<typeof listExternalToolConfigurations>>;
}) {
  return (
    <div className="drawer-stack">
      <form action={createOrchestrationConfigurationAction} className="panel form-panel">
        <input type="hidden" name="storyId" value={storyId} />
        <h3>创建编排</h3>
        <label><span>名称</span><input name="name" required /></label>
        <label><span>说明</span><textarea name="description" /></label>
        <label><span>默认模型 JSON</span><textarea name="modelDefaultsJson" defaultValue={'{"provider":"local-stub","model":"deterministic"}'} /></label>
        <button type="submit">创建编排</button>
      </form>
      <section className="panel list-panel" aria-label="Agent 编排列表">
        <div className="panel-heading"><h3>编排</h3><span>{configurations.length}</span></div>
        <ul className="material-list">
          {configurations.map((configuration) => (
            <li key={configuration.id} className="material-item">
              <div className="material-item-header">
                <div><h3>{configuration.name}</h3><p>{configuration.description || "暂无说明。"}</p></div>
                <form action={deleteOrchestrationConfigurationAction}>
                  <input type="hidden" name="storyId" value={storyId} />
                  <input type="hidden" name="configurationId" value={configuration.id} />
                  <button className="secondary danger" type="submit">删除</button>
                </form>
              </div>
              <ol className="agent-list">
                {configuration.assignments.map((assignment) => (
                  <li key={assignment.id}>
                    <div><strong>{assignment.orderIndex + 1}. {assignment.name}</strong><span>{assignment.agentRole} · {assignment.timeoutMs}ms</span></div>
                    <form action={deleteAgentAssignmentAction}>
                      <input type="hidden" name="storyId" value={storyId} />
                      <input type="hidden" name="configurationId" value={configuration.id} />
                      <input type="hidden" name="assignmentId" value={assignment.id} />
                      <button className="secondary danger" type="submit">移除</button>
                    </form>
                  </li>
                ))}
              </ol>
              <form action={createAgentAssignmentFromProfileAction} className="agent-form" aria-label={`从 Agent Profile 添加到 ${configuration.name}`}>
                <input type="hidden" name="storyId" value={storyId} />
                <input type="hidden" name="configurationId" value={configuration.id} />
                <label>
                  <span>选择 Agent Profile</span>
                  <select name="profileId" required>
                    <option value="">选择 Agent</option>
                    {agentProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                  </select>
                </label>
                <button type="submit">加入 Workflow</button>
              </form>
              <form action={createAgentAssignmentAction} className="agent-form" aria-label={`手动添加 Agent 到 ${configuration.name}`}>
                <input type="hidden" name="storyId" value={storyId} />
                <input type="hidden" name="configurationId" value={configuration.id} />
                <h4>手动添加 Agent</h4>
                <div className="form-row two">
                  <label><span>名称</span><input name="name" required /></label>
                  <label><span>角色</span><input name="agentRole" required /></label>
                </div>
                <label><span>指令</span><textarea name="instructions" /></label>
                <div className="form-row two">
                  <label><span>Skill Set JSON</span><textarea name="skillSetJson" defaultValue="[]" /></label>
                  <label><span>允许工具 JSON</span><textarea name="allowedToolsJson" defaultValue="[]" /></label>
                </div>
                <label><span>模型覆盖 JSON</span><textarea name="modelOverrideJson" /></label>
                <label><span>超时 ms</span><input name="timeoutMs" type="number" defaultValue="60000" /></label>
                <button type="submit">添加 Agent</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel list-panel" aria-label="外部工具配置">
        <div className="panel-heading"><h3>MCP 工具配置</h3><span>{externalTools.length}</span></div>
        <form action={createExternalToolConfigurationAction} className="agent-form">
          <input type="hidden" name="storyId" value={storyId} />
          <label><span>名称</span><input name="name" placeholder="web-search" required /></label>
          <label><span>MCP Config JSON</span><textarea name="configJson" defaultValue={'{"command":"example-mcp","args":[]}'} /></label>
          <label className="checkbox-label"><input name="enabled" type="checkbox" defaultChecked /> 启用</label>
          <button type="submit">添加 MCP 配置</button>
        </form>
        <ul className="tool-list">
          {externalTools.map((tool) => <li key={tool.id}><strong>{tool.name}</strong><span>{tool.providerType} · {tool.enabled ? "启用" : "禁用"}</span></li>)}
        </ul>
      </section>
    </div>
  );
}

function SaveManagerPanel({
  storyId,
  activeSessionId,
  activeSessionTitle,
  activeWikiDocumentId,
  playSessions,
  transcriptItems,
  progressWiki
}: {
  storyId: string;
  activeSessionId: string;
  activeSessionTitle: string;
  activeWikiDocumentId?: string;
  playSessions: unknown[];
  transcriptItems: unknown[];
  progressWiki: Awaited<ReturnType<typeof listProgressWiki>>;
}) {
  return (
    <div className="drawer-stack">
      <section className="panel list-panel" aria-label="存档列表">
        <div className="panel-heading"><h3>存档</h3><span>{playSessions.length}</span></div>
        <ul className="save-list">
          {playSessions.map((session) => {
            const sessionId = getSessionId(session);
            return (
              <li key={sessionId}>
                <Link
                  href={storyQueryHref(storyId, { sessionId, panel: "saves" })}
                  className={sessionId === activeSessionId ? "save-link active" : "save-link"}
                >
                  <strong>{getSessionTitle(session)}</strong>
                  <span>{getSessionDate(session) || "暂无更新时间"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <form action={createPlaySessionAction} className="compact-form">
          <input type="hidden" name="storyId" value={storyId} />
          <label><span>新存档名称</span><input name="title" defaultValue="新存档" required /></label>
          <button type="submit">创建存档</button>
        </form>
      </section>

      <section className="panel list-panel" aria-label="存档聊天记录">
        <div className="panel-heading"><h3>{activeSessionTitle}</h3><span>{transcriptItems.length}</span></div>
        {transcriptItems.length === 0 ? <p className="empty">这个存档还没有聊天记录。</p> : (
          <ol className="save-transcript-list">
            {transcriptItems.map((item, index) => (
              <li key={`${getTranscriptKind(item)}-${index}`}>
                <strong>{index + 1}. {getTranscriptKind(item)}</strong>
                <p>{getTranscriptText(item) || "没有文本。"}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <WikiFileManager
        storyId={storyId}
        sessionId={activeSessionId}
        activeWikiDocumentId={activeWikiDocumentId}
        progressWiki={progressWiki}
      />

      <section className="panel list-panel" aria-label="记忆快照">
        <div className="panel-heading"><h3>快照</h3><span>{progressWiki.snapshots.length}</span></div>
        <form action={createWikiSnapshotAction} className="compact-form">
          <input type="hidden" name="storyId" value={storyId} />
          <input type="hidden" name="sessionId" value={activeSessionId} />
          <label><span>记忆边界楼层</span><input name="memoryBoundaryPosition" type="number" min="0" defaultValue="0" /></label>
          <button type="submit">创建快照</button>
        </form>
        <ul className="snapshot-list">
          {progressWiki.snapshots.map((snapshot) => <li key={snapshot.id}><strong>边界 {snapshot.memoryBoundaryPosition}</strong><span>{snapshot.createdAt}</span></li>)}
        </ul>
      </section>
    </div>
  );
}

function WikiFileManager({
  storyId,
  sessionId,
  activeWikiDocumentId,
  progressWiki
}: {
  storyId: string;
  sessionId: string;
  activeWikiDocumentId?: string;
  progressWiki: Awaited<ReturnType<typeof listProgressWiki>>;
}) {
  const activeDocument =
    progressWiki.documents.find((document) => document.id === activeWikiDocumentId) ??
    progressWiki.documents[0] ??
    null;
  const folders = getWikiFolderRows(progressWiki.documents);

  return (
    <section className="panel wiki-manager" aria-label="记忆 Wiki">
      <div className="panel-heading"><h3>记忆 Wiki</h3><span>{progressWiki.documents.length}</span></div>
      <form action={createProgressWikiDocumentAction} className="compact-form">
        <input type="hidden" name="storyId" value={storyId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <label><span>路径 / 文件名</span><input name="title" placeholder="剧情/当前状态.md" required /></label>
        <label><span>类型</span><input name="documentType" defaultValue="note" /></label>
        <label><span>内容</span><textarea name="body" /></label>
        <input type="hidden" name="tagsJson" value="[]" />
        <button type="submit">创建文件</button>
      </form>

      <div className="wiki-browser-editor">
        <nav className="wiki-file-browser" aria-label="Wiki 文件浏览器">
          {progressWiki.documents.length === 0 ? <p className="empty">还没有 Wiki 文件。</p> : null}
          {folders.map((folder) => (
            <div key={folder.path} className="wiki-folder-row" style={{ paddingLeft: `${folder.depth * 14}px` }}>
              {folder.name}
            </div>
          ))}
          {progressWiki.documents.map((document) => {
            const segments = getWikiPathSegments(document.title);
            const fileName = segments.at(-1) ?? document.title;
            return (
              <Link
                key={document.id}
                href={storyQueryHref(storyId, { sessionId, panel: "saves", wikiDoc: document.id })}
                className={document.id === activeDocument?.id ? "wiki-file-row active" : "wiki-file-row"}
                style={{ paddingLeft: `${Math.max(0, segments.length - 1) * 14}px` }}
              >
                {fileName}
              </Link>
            );
          })}
        </nav>

        <div className="wiki-editor-panel" aria-label="Wiki 文件编辑器">
          {activeDocument ? (
            <>
              <form action={updateProgressWikiDocumentAction} className="wiki-document-form">
                <input type="hidden" name="storyId" value={storyId} />
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="documentId" value={activeDocument.id} />
                <label><span>路径 / 文件名</span><input name="title" defaultValue={activeDocument.title} required /></label>
                <label><span>类型</span><input name="documentType" defaultValue={activeDocument.documentType} /></label>
                <label><span>内容</span><textarea name="body" defaultValue={activeDocument.body} /></label>
                <label><span>标签 JSON</span><input name="tagsJson" defaultValue={activeDocument.tagsJson} /></label>
                <button type="submit">保存文件</button>
              </form>
              <form action={deleteProgressWikiDocumentAction}>
                <input type="hidden" name="storyId" value={storyId} />
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="documentId" value={activeDocument.id} />
                <button className="secondary danger" type="submit">删除文件</button>
              </form>
            </>
          ) : (
            <p className="empty">选择或创建一个 Wiki 文件后编辑内容。</p>
          )}
        </div>
      </div>
    </section>
  );
}

function getWikiPathSegments(title: string) {
  return title.split("/").map((segment) => segment.trim()).filter(Boolean);
}

function getWikiFolderRows(documents: Awaited<ReturnType<typeof listProgressWiki>>["documents"]) {
  const folders = new Map<string, { path: string; name: string; depth: number }>();
  for (const document of documents) {
    const segments = getWikiPathSegments(document.title);
    for (let index = 0; index < segments.length - 1; index += 1) {
      const path = segments.slice(0, index + 1).join("/");
      if (!folders.has(path)) {
        folders.set(path, {
          path,
          name: segments[index],
          depth: index
        });
      }
    }
  }
  return [...folders.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function TracePanel({ activeSessionTitle, workflowTraces }: { activeSessionTitle: string; workflowTraces: Awaited<ReturnType<typeof listWorkflowTracesForSession>> }) {
  return (
    <section className="panel list-panel" aria-label="运行记录列表">
      <div className="panel-heading"><h3>{activeSessionTitle}</h3><span>{workflowTraces.length}</span></div>
      {workflowTraces.length === 0 ? <p className="empty">还没有运行记录。</p> : (
        <ul className="trace-list">
          {workflowTraces.map((trace) => (
            <li key={trace.id} className="trace-item">
              <div className="trace-header"><div><h3>{trace.configuration?.name ?? "未知编排"}</h3><p>{trace.status} · {trace.startedAt}</p></div><span className={trace.status === "succeeded" ? "tag strong" : "tag danger-tag"}>{trace.status}</span></div>
              {trace.finalOutputText ? <p className="trace-output">{trace.finalOutputText}</p> : null}
              <ol className="trace-step-list">
                {trace.steps.map((step) => (
                  <li key={step.id}>
                    <strong>{step.orderIndex + 1}. {step.assignment?.name ?? "运行步骤"}</strong>
                    <span>{step.status}</span>
                    <details><summary>输入 / 输出</summary><pre>{step.inputPayloadJson}</pre>{step.outputText ? <pre>{step.outputText}</pre> : null}{step.subagentResultsJson ? <pre>{step.subagentResultsJson}</pre> : null}</details>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
