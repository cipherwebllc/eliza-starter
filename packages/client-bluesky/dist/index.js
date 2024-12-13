// src/index.ts
import { elizaLogger } from "@ai16z/eliza";

// src/client.ts
import { BskyAgent } from "@atproto/api";

// src/posts.ts
import { formatTimestamp } from "@ai16z/eliza";
var formatPosts = ({
  messages,
  actors,
  conversationHeader = true
}) => {
  const groupedMessages = {};
  messages.forEach((message) => {
    if (message.roomId) {
      if (!groupedMessages[message.roomId]) {
        groupedMessages[message.roomId] = [];
      }
      groupedMessages[message.roomId].push(message);
    }
  });
  Object.values(groupedMessages).forEach((roomMessages) => {
    roomMessages.sort((a, b) => {
      const timeA = a.createdAt ?? 0;
      const timeB = b.createdAt ?? 0;
      return timeA - timeB;
    });
  });
  const sortedRooms = Object.entries(groupedMessages).sort(
    ([, messagesA], [, messagesB]) => {
      const latestA = messagesA[messagesA.length - 1]?.createdAt ?? 0;
      const latestB = messagesB[messagesB.length - 1]?.createdAt ?? 0;
      return latestB - latestA;
    }
  );
  const formattedPosts = sortedRooms.map(([roomId, roomMessages]) => {
    const messageStrings = roomMessages.filter((message) => message.userId).map((message) => {
      const actor = actors.find(
        (actor2) => actor2.id === message.userId
      );
      const userName = actor?.name || "Unknown User";
      const displayName = actor?.username || "unknown";
      return `Name: ${userName} (@${displayName})
ID: ${message.id}${message.content.inReplyTo ? `
In reply to: ${message.content.inReplyTo}` : ""}
Date: ${formatTimestamp(message.createdAt ?? Date.now())}
Text:
${message.content.text}`;
    });
    const header = conversationHeader ? `Conversation: ${roomId.slice(-5)}
` : "";
    return `${header}${messageStrings.join("\n\n")}`;
  });
  return formattedPosts.join("\n\n");
};

// src/client.ts
var BlueskyClient = class {
  constructor(runtime) {
    this.type = "bluesky";
    this.runtime = runtime;
    this.agent = new BskyAgent({
      service: "https://bsky.social"
    });
  }
  async start(runtime) {
    if (runtime) {
      this.runtime = runtime;
    }
    const identifier = this.runtime.getSetting("BLUESKY_IDENTIFIER");
    const password = this.runtime.getSetting("BLUESKY_APP_PASSWORD");
    if (!identifier || !password) {
      throw new Error("Missing Bluesky credentials. Please set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD.");
    }
    await this.agent.login({ identifier, password });
    return void 0;
  }
  async stop(_runtime) {
    return void 0;
  }
  async createMessage(content, roomId) {
    const timestamp = (/* @__PURE__ */ new Date()).getTime();
    const actor = {
      id: this.runtime.getSetting("BLUESKY_IDENTIFIER"),
      name: this.runtime.getSetting("BLUESKY_NAME") || "Unknown User",
      username: this.runtime.getSetting("BLUESKY_USERNAME") || "unknown",
      details: {
        tagline: "",
        summary: "",
        quote: ""
      }
    };
    const formattedPost = formatPosts({
      messages: [{
        id: "temp",
        userId: actor.id,
        roomId,
        createdAt: timestamp,
        content,
        agentId: actor.id
      }],
      actors: [actor],
      conversationHeader: true
    });
    const blueskyPost = {
      text: formattedPost
    };
    const post = await this.agent.post({
      text: blueskyPost.text,
      createdAt: new Date(timestamp).toISOString()
    });
    return {
      id: post.uri,
      userId: actor.id,
      roomId,
      createdAt: timestamp,
      content: {
        ...content,
        text: content.text,
        action: content.action || void 0
      },
      agentId: actor.id
    };
  }
  async replyToMessage(content, replyTo, roomId) {
    if (!replyTo.id) {
      throw new Error("Cannot reply to message without ID");
    }
    const replyId = replyTo.id.toString();
    const timestamp = (/* @__PURE__ */ new Date()).getTime();
    const actor = {
      id: this.runtime.getSetting("BLUESKY_IDENTIFIER"),
      name: this.runtime.getSetting("BLUESKY_NAME") || "Unknown User",
      username: this.runtime.getSetting("BLUESKY_USERNAME") || "unknown",
      details: {
        tagline: "",
        summary: "",
        quote: ""
      }
    };
    const formattedPost = formatPosts({
      messages: [{
        id: "temp",
        userId: actor.id,
        roomId,
        createdAt: timestamp,
        content: {
          ...content,
          inReplyTo: replyTo.id
        },
        agentId: actor.id
      }],
      actors: [actor],
      conversationHeader: true
    });
    const blueskyPost = {
      text: formattedPost,
      replyTo: {
        uri: replyId,
        cid: replyId
      }
    };
    const post = await this.agent.post({
      text: blueskyPost.text,
      reply: {
        root: { uri: replyId, cid: replyId },
        parent: { uri: replyId, cid: replyId }
      },
      createdAt: new Date(timestamp).toISOString()
    });
    return {
      id: post.uri,
      userId: actor.id,
      roomId,
      createdAt: timestamp,
      content: {
        ...content,
        text: content.text,
        inReplyTo: replyTo.id,
        action: content.action || void 0
      },
      agentId: actor.id
    };
  }
  async deleteMessage(messageId) {
    await this.agent.deletePost(messageId);
  }
};

// src/environment.ts
async function validateBlueskyConfig(runtime) {
  const identifier = runtime.getSetting("BLUESKY_IDENTIFIER");
  const password = runtime.getSetting("BLUESKY_APP_PASSWORD");
  if (!identifier || !password) {
    throw new Error("Bluesky credentials not configured");
  }
}

// src/index.ts
var BlueskyClientInterface = {
  async start(runtime) {
    if (!runtime) {
      throw new Error("Runtime is required for Bluesky client");
    }
    await validateBlueskyConfig(runtime);
    const client = new BlueskyClient(runtime);
    await client.start(runtime);
    elizaLogger.log("Bluesky client started");
    return client;
  },
  async stop(_runtime) {
    elizaLogger.log("Bluesky client stopped");
    return void 0;
  }
};
export {
  BlueskyClientInterface
};
