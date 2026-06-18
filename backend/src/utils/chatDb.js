export function normalizeChatType(chat) {
  const raw = chat?.chat_type;
  if (!raw) return "direct";
  if (raw === "group" || raw === "self" || raw === "direct") return raw;
  return "direct";
}

export function directPeerId(chat, userId) {
  const chatType = normalizeChatType(chat);
  if (!chat || chatType === "group") return null;
  return Number(chat.user1_id) === Number(userId)
    ? Number(chat.user2_id)
    : Number(chat.user1_id);
}

export async function getDirectBlockState(db, userA, userB) {
  const me = Number(userA);
  const other = Number(userB);
  if (!me || !other) {
    return { blocked: false, blockedByA: false, blockedByB: false };
  }

  const rows = await db.collection("user_blocks").find({
    $or: [
      { blocker_user_id: me, blocked_user_id: other },
      { blocker_user_id: other, blocked_user_id: me }
    ]
  }, { projection: { blocker_user_id: 1 } }).toArray();

  const blockedByA = rows.some((row) => Number(row.blocker_user_id) === me);
  const blockedByB = rows.some((row) => Number(row.blocker_user_id) === other);

  return {
    blocked: blockedByA || blockedByB,
    blockedByA,
    blockedByB
  };
}

export async function getChatMembership(db, chatId, userId) {
  const normalizedChatId = Number(chatId);
  const normalizedUserId = Number(userId);
  if (!normalizedChatId || !normalizedUserId) return null;

  const chat = await db.collection("chats").findOne(
    { id: normalizedChatId },
    {
      projection: {
        _id: 0,
        id: 1,
        user1_id: 1,
        user2_id: 1,
        chat_type: 1,
        group_name: 1,
        group_avatar_url: 1,
        chat_background_url: 1,
        created_by_user_id: 1,
        last_message_at: 1
      }
    }
  );
  if (!chat) return null;

  const chatType = normalizeChatType(chat);

  if (chatType === "group") {
    const member = await db.collection("chat_members").findOne(
      { chat_id: normalizedChatId, user_id: normalizedUserId },
      { projection: { _id: 1 } }
    );
    if (!member) return null;
  } else if (Number(chat.user1_id) !== normalizedUserId && Number(chat.user2_id) !== normalizedUserId) {
    return null;
  }

  return { ...chat, chat_type: chatType };
}

export async function getChatParticipantIds(db, chat) {
  if (!chat) return [];
  const chatType = normalizeChatType(chat);
  if (chatType === "group") {
    const rows = await db.collection("chat_members")
      .find({ chat_id: Number(chat.id || chat.chat_id) }, { projection: { _id: 0, user_id: 1 } })
      .toArray();
    return rows.map((row) => Number(row.user_id)).filter(Boolean);
  }

  return [...new Set([Number(chat.user1_id), Number(chat.user2_id)].filter(Boolean))];
}

export async function usersAreConnectedByChat(db, userA, userB, chatId = null) {
  const a = Number(userA);
  const b = Number(userB);
  if (!a || !b) return false;

  const directFilter = {
    $or: [
      { chat_type: "direct" },
      { chat_type: null },
      { chat_type: { $exists: false } }
    ]
  };

  if (chatId) {
    const normalizedChatId = Number(chatId);
    if (!normalizedChatId) return false;
    const chat = await db.collection("chats").findOne(
      {
        id: normalizedChatId,
        ...directFilter,
        $or: [
          { user1_id: a, user2_id: b },
          { user1_id: b, user2_id: a }
        ]
      },
      { projection: { _id: 1 } }
    );
    return Boolean(chat);
  }

  const chat = await db.collection("chats").findOne(
    {
      ...directFilter,
      $or: [
        { user1_id: a, user2_id: b },
        { user1_id: b, user2_id: a }
      ]
    },
    { projection: { _id: 1 } }
  );
  return Boolean(chat);
}

