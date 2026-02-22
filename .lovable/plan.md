

# תיקון parentId שנשאר null -- Race Condition ב-AuthContext

## הבעיה

ה-RLS כבר תוקן (הפוליסות כעת PERMISSIVE), אבל ה-`parentId` נשאר `null` בגלל race condition ב-`AuthContext.tsx`.

### מה קורה בפועל:

1. `onAuthStateChange` מופעל עם session
2. `setUser(session.user)` נקרא (עדכון state אסינכרוני)
3. `setTimeout(() => handlePostAuth(session.user), 0)` נקרא
4. `handlePostAuth` קורא ל-`checkParentStatus()`
5. `checkParentStatus()` בודק `if (!user)` -- אבל `user` עדיין **null** כי React עדיין לא עיבד את ה-state update מצעד 2
6. לכן `parentId` לעולם לא מתעדכן

## הפתרון

### שינוי ב-AuthContext.tsx

שינוי `checkParentStatus` כך שיקבל את ה-user כפרמטר במקום לקרוא מה-state:

```typescript
const checkParentStatus = async (currentUser?: User | null) => {
  const u = currentUser ?? user;
  if (!u) {
    setIsNewUser(null);
    setParentId(null);
    return;
  }

  const { data, error } = await supabase
    .from('parents')
    .select('id')
    .eq('id', u.id)
    .maybeSingle();

  if (error) {
    setIsNewUser(true);
    return;
  }

  if (data) {
    setIsNewUser(false);
    setParentId(data.id);
  } else {
    setIsNewUser(true);
    setParentId(null);
  }
};
```

ועדכון `handlePostAuth` להעביר את ה-user:

```typescript
const handlePostAuth = async (sessionUser: User) => {
  const allowed = await enforceWaitlistAccess(sessionUser);
  if (!allowed) return;
  await checkParentStatus(sessionUser);
};
```

### שינוי ב-AlertCardStack.tsx שורה 349

שינוי מ-`parentId={parentId || ''}` ל-`parentId={parentId ?? ''}` כדי לא להמיר null למחרוזת ריקה (ה-guard ב-AlertFeedback יטפל ב-null).

## פירוט טכני

| קובץ | שינוי |
|------|-------|
| `src/contexts/AuthContext.tsx` | `checkParentStatus` מקבל user כפרמטר |
| `src/components/alerts/AlertCardStack.tsx` | שורה 349: `parentId \|\| ''` הופך ל-`parentId ?? ''` |

אין צורך בשינויי DB נוספים -- ה-RLS כבר תוקן.

