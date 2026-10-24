// `.open-next/worker.js` only exists after `opennextjs-cloudflare build`. This declares the parts
// of it that worker.ts uses so type-check works without a build.
declare module "*/.open-next/worker.js" {
  const handler: {
    fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response>;
  };
  export default handler;
  export class DOQueueHandler {}
  export class DOShardedTagCache {}
}
