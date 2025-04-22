declare module 'gun' {
  interface IGunInstance<TNode = any> {
    get: (key: string) => IGunChain<TNode>;
    put: (data: any, cb?: (ack: any) => void) => void;
    on: (cb: (data: any) => void) => { off: () => void };
    once: (cb: (data: any, key: string) => void) => void;
    map: () => IGunChain<TNode>;
    user: () => IGunUserInstance;
  }

  interface IGunUserInstance {
    _: {
      sea?: {
        pub?: string;
        epub?: string;
      };
      $: any;
      opt: any;
      on: any;
    };
    get: (key: string) => IGunChain<any>;
    put: (data: any, cb?: (ack: any) => void) => void;
    create: (alias: string, pass: string, cb: (ack: any) => void) => void;
    auth: (alias: string, pass: string, cb: (ack: any) => void) => void;
    leave: () => void;
  }

  interface IGunChain<TNode> {
    get: (key: string) => IGunChain<TNode>;
    put: (data: any, cb?: (ack: any) => void) => void;
    on: (cb: (data: any) => void) => { off: () => void };
    once: (cb: (data: any, key: string) => void) => void;
    map: () => IGunChain<TNode>;
    set: (data: any, cb?: (ack: any) => void) => void;
  }
}