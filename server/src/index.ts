import * as socket from "socket.io";
import { Server } from "socket.io";
import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { withPulse } from "@prisma/extension-pulse";

const prisma = new PrismaClient().$extends(
  withPulse({
    apiKey: process.env.PULSE_API_KEY || "",
  })
);

const app = express();
app.use(cors());

app.get(`/messages`, async (_: Request, res: Response) => {
  const messages = await prisma.message.findMany();
  res.json(messages);
});

const server = http.createServer(app);

const io = new socket.Server(server, {
  cors: { origin: true },
});

io.on(`connection`, async (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on(`disconnect`, () => {
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on(`chat-message`, async (text) => {
    console.log(`Received message: ${text} (${socket.id})`);
    await prisma.message.create({
      data: {
        text,
        senderSocketId: socket.id,
      },
    });
  });

  socket.on(`chat-delete`, async (id) => {
    console.log(`Received deletion: ${id} (${socket.id})`);
    await prisma.message.delete({
      where: { id: id },
    });
  });

  socket.on(`chat-vote`, async ({ id, vote }) => {
    console.log(`Received vote: ${id} ${vote} (${socket.id})`);
    await prisma.message.update({
      data: {
        upvotes: {
          increment: vote,
        },
      },
      where: { id: id },
    });
  });
});

server.listen(4000, async () => {
  console.log(`Server running on http://localhost:4000`);
  await streamChatMessages(io);
});

async function streamChatMessages(io: Server) {
  console.log(`Streaming messages with Prisma Client ...`);
  const stream = await prisma.message.stream({
    create: {},
    delete: {},
    update: {},
  });

  // Handle Prisma stream events
  for await (const event of stream) {
    console.log(`New event from Pulse: `, event);
    switch (event.action) {
      case "create":
        io.sockets.emit("chat-message", event.created);
        break;
      case "delete":
        io.sockets.emit("chat-deleted", event.deleted.id);
        break;
      case "update":
        io.sockets.emit("chat-updated", event.after);
        break;
    }
  }
}
