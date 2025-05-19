// src/lib/types/gun.d.ts

import type { IGunInstance, IGunChain } from 'gun';

declare global {
  interface Window {
    /** your singleton Gun instance, mounted in +page.svelte via window.gun = getGun() */
    gun: IGunInstance<any>;
  }
}

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
    delete: (alias: string, password: string, cb?: (ack: { err?: string; ok?: boolean }) => void) => this;
  }

  /**
   * A Gun chain node, used for get()/map()/set() etc.
   */
  interface IGunChain<TNode = any> {
    get(key: string): IGunChain<TNode>;
    put(data: any, cb?: (ack: any) => void): void;
    on(cb: (data: any) => void): { off: () => void };
    once(cb: (data: any, key: string) => void): void;
    map(): IGunChain<TNode>;
    set(data: any, cb?: (ack: any) => void): void;
    unset(data: any, cb?: (ack: any) => void): void;
  }
}

export {};
