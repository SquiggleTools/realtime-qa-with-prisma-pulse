"use client";

import { useState, useEffect, useRef, MutableRefObject } from "react";
import { io, Socket } from "socket.io-client";
import { Message, MessageView } from "./components/MessageView";

export default function Home() {
  const [message, setMessage] = useState("");
  const [messageHistory, setMessageHistory] = useState<Record<string, Message>>(
    {}
  );

  let socketRef: MutableRefObject<Socket | null> = useRef(null);

  const newMessageReceived = (message: Message) => {
    console.log(`Received message:`, message);
    setMessageHistory((oldMessageHistory) => ({
      ...oldMessageHistory,
      [message.id]: message,
    }));
  };

  const messageDeleted = (id: string) => {
    console.log(`Deleting message id:`, id);
    setMessageHistory((oldMessageHistory) => {
      const newMessageHistory = { ...oldMessageHistory };
      delete newMessageHistory[id];
      return newMessageHistory;
    });
  };

  const messageUpdated = (after: Message) => {
    console.log(`Updating message:`, after);
    setMessageHistory((oldMessageHistory) => ({
      ...oldMessageHistory,
      [after.id]: after,
    }));
  };

  useEffect(() => {
    const url = `http://localhost:4000`;

    async function fetchMessageHistory() {
      const responseData = await fetch(`${url}/messages`);
      const response = (await responseData.json()) as Message[];
      setMessageHistory(
        Object.fromEntries(response.map((message) => [message.id, message]))
      );
    }
    fetchMessageHistory();

    socketRef.current = io(url);
    socketRef.current.on(`chat-message`, newMessageReceived);
    socketRef.current.on(`chat-deleted`, messageDeleted);
    socketRef.current.on(`chat-updated`, messageUpdated);

    return () => {
      socketRef.current?.off(`chat-message`, newMessageReceived);
      socketRef.current?.off(`chat-deleted`, messageDeleted);
      socketRef.current?.off(`chat-updated`, messageUpdated);
    };
  }, []);

  const sendMessage = async (e: any) => {
    e.preventDefault();
    const newMessage = message;
    setMessage(``);
    console.log(`Send message`, newMessage);
    socketRef.current?.emit(`chat-message`, newMessage);
  };

  const messagesSorted = Object.values(messageHistory).sort(
    (a, b) => b.upvotes - a.upvotes
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 bg-gray-100">
      <div className="w-full md:w-2/3 lg:w-1/2 bg-white p-6 rounded-xl shadow-md">
        <div className="overflow-y-auto max-h-[70vh]">
          {messagesSorted.map((message) => (
            <MessageView
              key={message.id}
              message={message}
              onDelete={() => {
                console.log(`Deleting`, message.id);
                socketRef.current?.emit(`chat-delete`, message.id);
              }}
              sendVote={(vote) => {
                console.log(`Voting`, message.id, vote);
                socketRef.current?.emit(`chat-vote`, { id: message.id, vote });
              }}
            />
          ))}
        </div>
      </div>

      <form
        id="text-input-container"
        className="py-4 px-2 w-full flex items-center justify-center"
        onSubmit={sendMessage}
      >
        <div className="bg-white w-full md:w-2/3 lg:w-1/2 px-3 py-2 flex gap-3 rounded-xl shadow-lg">
          <input
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            id="message"
            className="focus:outline-none px-2 flex-1 rounded-xl border border-gray-300"
            type="text"
            placeholder="What do you want to say?"
            autoComplete="off"
          />
          <button
            type="submit"
            className="rounded-xl px-3 py-2 bg-blue-600 text-white text-sm"
          >
            Send
          </button>
        </div>
      </form>
    </main>
  );
}
