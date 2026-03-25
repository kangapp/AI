import { describe, test, expect, beforeEach } from "bun:test";
import { EventEmitter } from "./emitter";

describe("EventEmitter", () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  test("emit and on basic functionality", () => {
    let receivedData: any;
    emitter.on("test", (data) => {
      receivedData = data;
    });
    emitter.emit("test", { message: "hello" });
    expect(receivedData).toEqual({ message: "hello" });
  });

  test("off removes handler", () => {
    let callCount = 0;
    const handler = () => {
      callCount++;
    };
    emitter.on("test", handler);
    emitter.emit("test", {});
    expect(callCount).toBe(1);

    emitter.off("test", handler);
    emitter.emit("test", {});
    expect(callCount).toBe(1);
  });

  test("multiple handlers for same event", () => {
    let count1 = 0;
    let count2 = 0;
    emitter.on("test", () => count1++);
    emitter.on("test", () => count2++);
    emitter.emit("test", {});
    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });

  test("handlers receive correct data", () => {
    const testData = { name: "test", value: 42 };
    let receivedData: any;
    emitter.on("data", (data) => {
      receivedData = data;
    });
    emitter.emit("data", testData);
    expect(receivedData).toBe(testData);
  });

  test("getHistory returns all emitted events", () => {
    emitter.emit("event1", { data: 1 });
    emitter.emit("event2", { data: 2 });
    emitter.emit("event1", { data: 3 });

    const history = emitter.getHistory();
    expect(history.length).toBe(3);
    expect(history[0].event).toBe("event1");
    expect(history[0].data).toEqual({ data: 1 });
    expect(history[1].event).toBe("event2");
    expect(history[1].data).toEqual({ data: 2 });
    expect(history[2].event).toBe("event1");
    expect(history[2].data).toEqual({ data: 3 });
  });

  test("getHistory returns copies of history", () => {
    emitter.emit("test", { data: 1 });
    const history1 = emitter.getHistory();
    const history2 = emitter.getHistory();

    expect(history1).not.toBe(history2);
    expect(history1).toEqual(history2);
  });

  test("history contains timestamps", () => {
    const before = Date.now();
    emitter.emit("test", {});
    const after = Date.now();

    const history = emitter.getHistory();
    expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(history[0].timestamp).toBeLessThanOrEqual(after);
  });
});
