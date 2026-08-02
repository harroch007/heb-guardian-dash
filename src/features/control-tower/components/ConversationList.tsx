import { Search, SearchX } from "lucide-react";
import type { ConversationListItem } from "../domain/types";
import { ConversationListItemView } from "./ConversationListItemView";

export function ConversationList({
  conversations,
  selectedId,
  search,
  onSearch,
  onSelect,
  loading,
}: {
  conversations: readonly ConversationListItem[];
  selectedId: string | null;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  return (
    <section className="ct-inbox-list" aria-labelledby="ct-inbox-title">
      <div className="ct-inbox-heading">
        <div>
          <p className="ct-eyebrow">Company Inbox</p>
          <h2 id="ct-inbox-title">פניות פעילות</h2>
        </div>
        <span className="ct-count">{conversations.length}</span>
      </div>
      <label className="ct-search">
        <Search size={17} aria-hidden="true" />
        <span className="ct-visually-hidden">חיפוש בפניות</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="חיפוש בשם מוסווה או בנושא"
        />
      </label>
      {loading ? (
        <div className="ct-list-placeholder" role="status">טוענים פניות…</div>
      ) : conversations.length > 0 ? (
        <ul className="ct-conversation-list">
          {conversations.map((conversation) => (
            <ConversationListItemView
              key={conversation.conversationId}
              conversation={conversation}
              selected={conversation.conversationId === selectedId}
              onSelect={() => onSelect(conversation.conversationId)}
            />
          ))}
        </ul>
      ) : (
        <div className="ct-empty-inline">
          <SearchX size={22} aria-hidden="true" />
          <p>לא נמצאו פניות תואמות.</p>
        </div>
      )}
    </section>
  );
}
