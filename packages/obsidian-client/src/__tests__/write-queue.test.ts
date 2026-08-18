import PQueue from 'p-queue';
import { createObsidianClient } from '../index';

const delay = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

describe('write queue — FIFO ordering under concurrency 1', () => {
  it('executes tasks in insertion order regardless of completion time', async () => {
    const queue = new PQueue({ concurrency: 1 });
    const log: number[] = [];

    // Three tasks with delays in descending order — would interleave if concurrent.
    await Promise.all([
      queue.add(async () => { await delay(30); log.push(1); }),
      queue.add(async () => { await delay(20); log.push(2); }),
      queue.add(async () => { await delay(10); log.push(3); }),
    ]);

    expect(log).toEqual([1, 2, 3]);
  });

  it('does not start the next task until the current one resolves', async () => {
    const queue = new PQueue({ concurrency: 1 });
    let running = 0;
    let maxConcurrent = 0;

    const task = async (): Promise<void> => {
      running++;
      maxConcurrent = Math.max(maxConcurrent, running);
      await delay(10);
      running--;
    };

    await Promise.all([queue.add(task), queue.add(task), queue.add(task)]);
    expect(maxConcurrent).toBe(1);
  });
});

describe('createObsidianClient — writes go through the write queue', () => {
  it('putNote and appendNote are serialized in FIFO order', async () => {
    const log: string[] = [];
    let releasePut!: () => void;

    const mockSecureStore = {
      getItemAsync: async (_key: string) => 'test-api-key',
      setItemAsync: async (_key: string, _val: string) => { /* noop */ },
    };

    const mockFetch = jest.fn(async (url: string) => {
      if ((url as string).includes('first')) {
        // Block until released so the second write can't start.
        await new Promise<void>((res) => { releasePut = res; });
        log.push('first');
      } else {
        log.push('second');
      }
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const client = createObsidianClient({
      secureStore: mockSecureStore,
      fetchImpl: mockFetch,
    });

    const p1 = client.putNote('first.md', 'a');
    const p2 = client.appendNote('second.md', 'b');

    // Give the event loop a tick — second write should be waiting on the queue.
    await delay(5);
    expect(log).toEqual([]); // first hasn't released yet
    releasePut();

    await Promise.all([p1, p2]);
    expect(log).toEqual(['first', 'second']);
  });
});
