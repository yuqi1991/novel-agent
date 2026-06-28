import { StoryLibraryDrawerClient } from "./story-drawer-client";
import { listPlaySessions } from "@/services/session-service";
import { listStories } from "@/services/story-service";

export default async function StoryLibraryPage() {
  const stories = await listStories();
  const storiesWithSessions = await Promise.all(
    stories.map(async (story) => {
      const sessions = await listPlaySessions(story.id);
      return {
        ...story,
        latestSessionId: sessions.at(-1)?.id ?? null
      };
    })
  );

  return (
    <main className="chat-shell">
      <header className="app-topbar">
        <a href="/" className="brand-link">Novel Agent</a>
        <div className="story-title-block">
          <strong>故事库</strong>
          <span>选择或创建一个单人文字 RP 故事</span>
        </div>
      </header>

      <section className="home-layout">
        <section className="home-hero chat-window-placeholder">
          <p className="eyebrow">本地单人文字 RP</p>
          <h1>故事库</h1>
          <p className="lede">从右侧故事库选择故事会直接切换到它最后一次存档，并打开故事资料编辑面板。</p>
        </section>
        <aside className="side-drawer static-drawer" aria-label="故事库">
          <div className="drawer-header">
            <h2>故事库</h2>
          </div>
          <StoryLibraryDrawerClient stories={storiesWithSessions} />
        </aside>
      </section>
    </main>
  );
}
