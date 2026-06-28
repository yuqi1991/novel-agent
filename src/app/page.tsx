import { StoryLibraryDrawerClient } from "./story-drawer-client";
import { listStories } from "@/services/story-service";

export default async function StoryLibraryPage() {
  const stories = await listStories();

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
        <section className="home-hero">
          <p className="eyebrow">本地单人文字 RP</p>
          <h1>故事库</h1>
          <p className="lede">创建故事，导入 SillyTavern 角色卡或世界书，然后进入聊天窗口开始游玩。</p>
        </section>
        <aside className="side-drawer static-drawer" aria-label="故事库">
          <div className="drawer-header">
            <h2>故事库</h2>
          </div>
          <StoryLibraryDrawerClient stories={stories} />
        </aside>
      </section>
    </main>
  );
}
