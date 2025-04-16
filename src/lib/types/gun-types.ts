/**
 * Type definitions for GunDB
 * 
 * These types help TypeScript understand the structure and behavior of Gun.js objects
 */

/**
 * Base Gun data node type that wraps actual data with Gun metadata
 */
export interface GunDataNode<T> {
  _: {
    '#': string;
    '>': Record<string, number>;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Generic callback type for Gun operations
 */
export type GunCallback<T, K extends string> = (data: GunDataNode<T>, key: K) => void;

/**
 * Type for Gun's once() callback
 */
export type GunCallbackOnce<T, K extends string> = GunCallback<T, K>;

/**
 * Type for Gun's on() callback
 */
export type GunCallbackOn<T, K extends string> = GunCallback<T, K>;

/**
 * Type for a Gun reference path
 */
export interface GunReference {
  '#': string;
}